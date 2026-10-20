#!/usr/bin/env bash
set -euo pipefail

# ─── Configuration ───────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="$SCRIPT_DIR"

EMSDK_DIR="${EMSDK_DIR:-$HOME/emsdk}"
CHUFFED_DIR="$BUILD_DIR/chuffed"
LIBMINIZINC_DIR="$BUILD_DIR/libminizinc"
MINIZINC_JS_DIR="$BUILD_DIR/minizinc-js"

CHUFFED_BUILD="$BUILD_DIR/chuffed-build"
CHUFFED_INSTALL="$BUILD_DIR/chuffed-install"
MZN_BUILD="$BUILD_DIR/mzn-build"
MZN_INSTALL="$BUILD_DIR/mzn-install"

# Fork of Chuffed with true-candidates support.
# To use your own fork, change this URL.
CHUFFED_REPO="https://github.com/BenKarcher/chuffed.git"
LIBMINIZINC_REPO="https://github.com/MiniZinc/libminizinc.git"
MINIZINC_JS_REPO="https://github.com/MiniZinc/minizinc-js.git"

# ─── Helpers ─────────────────────────────────────────────────────────────────
step() { echo -e "\n\033[1;34m==> $1\033[0m"; }
warn() { echo -e "\033[1;33mWARN: $1\033[0m"; }

# ─── Step 1: Emscripten SDK ─────────────────────────────────────────────────
activate_emsdk() {
    step "Activating Emscripten SDK from $EMSDK_DIR"
    if [ ! -f "$EMSDK_DIR/emsdk_env.sh" ]; then
        echo "ERROR: emsdk not found at $EMSDK_DIR"
        echo "Set EMSDK_DIR env var or install emsdk at ~/emsdk"
        exit 1
    fi
    source "$EMSDK_DIR/emsdk_env.sh"
    echo "emcc version: $(emcc --version | head -1)"
}

# ─── Step 2: Clone repos ────────────────────────────────────────────────────
clone_repos() {
    step "Cloning repositories"
    if [ ! -d "$CHUFFED_DIR" ]; then
        git clone "$CHUFFED_REPO" "$CHUFFED_DIR"
    fi
    if [ ! -d "$LIBMINIZINC_DIR" ]; then
        git clone "$LIBMINIZINC_REPO" "$LIBMINIZINC_DIR"
    fi
    if [ ! -d "$MINIZINC_JS_DIR" ]; then
        git clone "$MINIZINC_JS_REPO" "$MINIZINC_JS_DIR"
    fi
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
download_vendors() {
    step "Downloading vendor solvers (Gecode, HiGHS, CBC)"
    cd "$LIBMINIZINC_DIR"
    MZNARCH=wasm ./download_vendor
    cd "$BUILD_DIR"
}

# ─── Step 5: Build libminizinc with Emscripten + custom Chuffed ──────────────
build_libminizinc() {
    step "Building libminizinc with Emscripten (custom Chuffed)"
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

# ─── Step 7: Copy artifacts to puzzle_solver/static/ ─────────────────────────
install_artifacts() {
    step "Installing WASM artifacts to static/"
    local dist="$MINIZINC_JS_DIR/dist"
    local dest="$PROJECT_ROOT/static"

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
        install)    install_artifacts ;;
        all)
            activate_emsdk
            clone_repos
            build_chuffed
            download_vendors
            build_libminizinc
            build_minizinc_js
            install_artifacts
            ;;
        *)
            echo "Usage: $0 {all|clone|chuffed|vendors|minizinc|js|install} [step2] ..."
            echo ""
            echo "Steps (chainable, or 'all' for everything):"
            echo "  clone     - Clone chuffed, libminizinc, minizinc-js repos"
            echo "  chuffed   - Build Chuffed with Emscripten"
            echo "  vendors   - Download Gecode/HiGHS/CBC prebuilt WASM vendors"
            echo "  minizinc  - Build libminizinc with custom Chuffed"
            echo "  js        - Build minizinc-js npm package"
            echo "  install   - Copy WASM artifacts to static/"
            exit 1
            ;;
    esac
}

if [ $# -eq 0 ]; then
    run_step all
else
    for step in "$@"; do
        run_step "$step"
    done
fi
