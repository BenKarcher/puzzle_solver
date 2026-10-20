#!/usr/bin/env bash
set -euo pipefail

# ─── Configuration ───────────────────────────────────────────────────────────
# Every setting below can be overridden from the environment, e.g. to build a
# local Chuffed checkout into a scratch directory:
#   CHUFFED_REPO=~/Projects/chuffed BUILD_DIR=/tmp/wasm INSTALL_DIR=/tmp/wasm/out ./build.sh all
# An existing checkout is not updated; `git pull` it (or delete it) to rebuild
# from the latest commit of its ref.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="${BUILD_DIR:-$SCRIPT_DIR}"
INSTALL_DIR="${INSTALL_DIR:-$PROJECT_ROOT/static}"
PATCH_DIR="$SCRIPT_DIR/patches"

EMSDK_DIR="${EMSDK_DIR:-$HOME/emsdk}"
CHUFFED_DIR="$BUILD_DIR/chuffed"
LIBMINIZINC_DIR="$BUILD_DIR/libminizinc"
MINIZINC_JS_DIR="$BUILD_DIR/minizinc-js"

CHUFFED_BUILD="$BUILD_DIR/chuffed-build"
CHUFFED_INSTALL="$BUILD_DIR/chuffed-install"
MZN_BUILD="$BUILD_DIR/mzn-build"
MZN_INSTALL="$BUILD_DIR/mzn-install"

# Fork of Chuffed with true-candidates support and the connected/tree
# propagator soundness fix.
CHUFFED_REPO="${CHUFFED_REPO:-https://github.com/BenKarcher/chuffed.git}"
CHUFFED_REF="${CHUFFED_REF:-develop}"
# libminizinc release to build against; its vendor.lock pins the vendor
# solvers and the emsdk version used below.
LIBMINIZINC_REPO="${LIBMINIZINC_REPO:-https://github.com/MiniZinc/libminizinc.git}"
LIBMINIZINC_REF="${LIBMINIZINC_REF:-2.10.1}"
MINIZINC_JS_REPO="${MINIZINC_JS_REPO:-https://github.com/MiniZinc/minizinc-js.git}"
MINIZINC_JS_REF="${MINIZINC_JS_REF:-v4.5.2}"

# Prebuilt WASM vendor solvers linked into libminizinc (Chuffed is our own).
VENDOR_REPO="https://github.com/MiniZinc/minizinc-vendor"
VENDOR_DEPS=(gecode cbc highs)
VENDOR_TRIPLE="wasm32-emscripten"

# ─── Helpers ─────────────────────────────────────────────────────────────────
step() { echo -e "\n\033[1;34m==> $1\033[0m"; }
warn() { echo -e "\033[1;33mWARN: $1\033[0m"; }
die() { echo -e "\033[1;31mERROR: $1\033[0m" >&2; exit 1; }

# Version pinned for a dependency in libminizinc's vendor.lock.
vendor_version() {
    local lock="$LIBMINIZINC_DIR/vendor.lock"
    [ -f "$lock" ] || die "$lock not found (run the 'clone' step first)"
    local v
    v="$(grep -E "^$1=" "$lock" | head -1 | cut -d= -f2-)"
    [ -n "$v" ] || die "no version pinned for '$1' in $lock"
    echo "$v"
}

# Clone repo at ref into dir, or check that an existing checkout is at ref.
clone_at() {
    local repo="$1" ref="$2" dir="$3"
    if [ ! -d "$dir" ]; then
        git clone --branch "$ref" "$repo" "$dir"
        return
    fi
    local head want
    head="$(git -C "$dir" rev-parse HEAD)"
    want="$(git -C "$dir" rev-parse --verify --quiet "$ref^{commit}" || true)"
    if [ "$head" != "$want" ]; then
        warn "$dir is not at $ref (HEAD $(git -C "$dir" log --oneline -1)); leaving it as is"
    else
        echo "$dir already at $ref"
    fi
}

# Apply a patch unless it is already applied.
apply_patch() {
    local dir="$1" patch="$2"
    if git -C "$dir" apply --check "$patch" 2>/dev/null; then
        git -C "$dir" apply "$patch"
        echo "  applied $(basename "$patch")"
    elif git -C "$dir" apply --reverse --check "$patch" 2>/dev/null; then
        echo "  $(basename "$patch") already applied"
    else
        die "$(basename "$patch") does not apply to $dir"
    fi
}

# ─── Step 1: Emscripten SDK ─────────────────────────────────────────────────
# Uses the emsdk version from vendor.lock: the vendor archives were built with
# it and must be linked with it.
activate_emsdk() {
    local version
    version="$(vendor_version emsdk)"
    step "Activating Emscripten SDK $version from $EMSDK_DIR"
    if [ ! -x "$EMSDK_DIR/emsdk" ]; then
        die "emsdk not found at $EMSDK_DIR. Install it with:
  git clone https://github.com/emscripten-core/emsdk.git $EMSDK_DIR
or set EMSDK_DIR."
    fi
    "$EMSDK_DIR/emsdk" install "$version"
    "$EMSDK_DIR/emsdk" activate "$version" >/dev/null
    # shellcheck disable=SC1091
    source "$EMSDK_DIR/emsdk_env.sh" >/dev/null
    echo "emcc version: $(emcc --version | head -1)"
}

# ─── Step 2: Clone repos ────────────────────────────────────────────────────
clone_repos() {
    step "Cloning repositories"
    clone_at "$CHUFFED_REPO" "$CHUFFED_REF" "$CHUFFED_DIR"
    clone_at "$LIBMINIZINC_REPO" "$LIBMINIZINC_REF" "$LIBMINIZINC_DIR"
    clone_at "$MINIZINC_JS_REPO" "$MINIZINC_JS_REF" "$MINIZINC_JS_DIR"
}

# ─── Step 3: Build Chuffed with Emscripten ───────────────────────────────────
build_chuffed() {
    step "Building Chuffed with Emscripten"
    mkdir -p "$CHUFFED_BUILD"

    cd "$CHUFFED_BUILD"
    if [ ! -f CMakeCache.txt ]; then
        emcmake cmake "$CHUFFED_DIR" \
            -DCMAKE_BUILD_TYPE=Release \
            -DCMAKE_FIND_ROOT_PATH="/" \
            -DCMAKE_INSTALL_PREFIX="$CHUFFED_INSTALL"
    fi

    cmake --build . --target install
    cd "$BUILD_DIR"
    echo "Chuffed installed to: $CHUFFED_INSTALL"
}

# ─── Step 4: Download other solver vendors for libminizinc ───────────────────
# Same archives as libminizinc's scripts/fetch_vendor.sh, without needing gh.
download_vendors() {
    step "Downloading vendor solvers (${VENDOR_DEPS[*]})"
    VENDOR_TMP="$(mktemp -d)"
    trap 'rm -rf "$VENDOR_TMP"' EXIT
    mkdir -p "$LIBMINIZINC_DIR/vendor"
    for dep in "${VENDOR_DEPS[@]}"; do
        local version asset
        version="$(vendor_version "$dep")"
        asset="$dep-$version-$VENDOR_TRIPLE.tar.gz"
        echo "  $asset"
        curl -fsSL -o "$VENDOR_TMP/$asset" "$VENDOR_REPO/releases/download/$dep-$version/$asset"
        rm -rf "${LIBMINIZINC_DIR:?}/vendor/$dep"
        tar -xzf "$VENDOR_TMP/$asset" -C "$LIBMINIZINC_DIR/vendor"
    done
}

# ─── Step 5: Build libminizinc with Emscripten + custom Chuffed ──────────────
build_libminizinc() {
    step "Building libminizinc with Emscripten (custom Chuffed)"
    # Let the built-in Chuffed accept --true-candidates.
    for patch in "$PATCH_DIR"/libminizinc-*.patch; do
        apply_patch "$LIBMINIZINC_DIR" "$patch"
    done
    # Remove vendor Chuffed so cmake uses our custom build
    rm -rf "$LIBMINIZINC_DIR/vendor/chuffed"
    mkdir -p "$MZN_BUILD"

    cd "$MZN_BUILD"
    if [ ! -f CMakeCache.txt ]; then
        emcmake cmake "$LIBMINIZINC_DIR" \
            -DCMAKE_FIND_ROOT_PATH="/" \
            -DCMAKE_BUILD_TYPE=Release \
            -DGecode_ROOT="$LIBMINIZINC_DIR/vendor/gecode" \
            -DOsiCBC_ROOT="$LIBMINIZINC_DIR/vendor/cbc" \
            -Dchuffed_DIR="$CHUFFED_INSTALL/lib/cmake/chuffed" \
            -DCMAKE_PREFIX_PATH="$LIBMINIZINC_DIR/vendor/highs/lib/cmake/highs:$CHUFFED_INSTALL/lib/cmake/chuffed" \
            -DCMAKE_INSTALL_PREFIX="$MZN_INSTALL"
    fi

    cmake --build . --target install
    cd "$BUILD_DIR"
    echo "libminizinc installed to: $MZN_INSTALL"
}

# ─── Step 6: Build minizinc-js package ───────────────────────────────────────
build_minizinc_js() {
    step "Building minizinc-js package"
    cd "$MINIZINC_JS_DIR"
    npm install

    # Point at the WASM install directory.
    # cmake install puts WASM/JS files in bin/ under the install prefix.
    # If cmake didn't create bin/, link the build-dir artifacts there.
    if [ ! -f "$MZN_INSTALL/bin/minizinc.wasm" ]; then
        mkdir -p "$MZN_INSTALL/bin"
        cp "$MZN_BUILD/minizinc.wasm" "$MZN_BUILD/minizinc.data" "$MZN_BUILD/minizinc.js" "$MZN_INSTALL/bin/"
    fi
    export MZN_WASM_DIR="$MZN_INSTALL"
    npm run build
    cd "$BUILD_DIR"
}

# ─── Step 7: Test the WASM build ─────────────────────────────────────────────
test_wasm() {
    step "Testing the WASM build"
    node "$SCRIPT_DIR/test-candidates.mjs" "$MZN_INSTALL/bin"
}

# ─── Step 8: Copy artifacts to puzzle_solver/static/ ─────────────────────────
install_artifacts() {
    step "Installing WASM artifacts to $INSTALL_DIR"
    local dist="$MINIZINC_JS_DIR/dist"
    local dest="$INSTALL_DIR"
    mkdir -p "$dest"

    for f in minizinc.wasm minizinc.data minizinc-worker.js; do
        if [ -f "$dist/$f" ]; then
            cp "$dist/$f" "$dest/$f"
            echo "  copied $f ($(du -h "$dest/$f" | cut -f1))"
        else
            warn "$f not found in $dist"
        fi
    done
    echo "Done! Restart your dev server to pick up the new WASM."
}

# ─── Main ────────────────────────────────────────────────────────────────────
run_step() {
    case "$1" in
        clone)      clone_repos ;;
        chuffed)    activate_emsdk && build_chuffed ;;
        vendors)    download_vendors ;;
        minizinc)   activate_emsdk && build_libminizinc ;;
        js)         build_minizinc_js ;;
        test)       test_wasm ;;
        install)    install_artifacts ;;
        all)
            clone_repos
            activate_emsdk
            build_chuffed
            download_vendors
            build_libminizinc
            build_minizinc_js
            test_wasm
            install_artifacts
            ;;
        *)
            echo "Usage: $0 {all|clone|chuffed|vendors|minizinc|js|test|install} [step2] ..."
            echo ""
            echo "Steps (chainable, or 'all' for everything):"
            echo "  clone     - Clone chuffed, libminizinc, minizinc-js at the pinned refs"
            echo "  chuffed   - Build Chuffed with Emscripten"
            echo "  vendors   - Download Gecode/HiGHS/CBC prebuilt WASM vendors"
            echo "  minizinc  - Patch and build libminizinc with custom Chuffed"
            echo "  js        - Build minizinc-js package"
            echo "  test      - Run the WASM build on regression models (needs node)"
            echo "  install   - Copy WASM artifacts to static/"
            exit 1
            ;;
    esac
}

mkdir -p "$BUILD_DIR"
cd "$BUILD_DIR"
if [ $# -eq 0 ]; then
    run_step all
else
    for step in "$@"; do
        run_step "$step"
    done
fi
