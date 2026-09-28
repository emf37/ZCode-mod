#!/usr/bin/env sh
# 从 GitHub Release 安装 ZCode。
#
# 行为与发行包自带的 install.sh 一致：同样的安装目录、bin 包装脚本、current 软链。
# 区别只在取包地址。install.sh 需要一份「latest.json + releases/<版本>/<包>」的目录布局，
# 通常放在静态托管上；GitHub Release 的资产是平铺的，没有 releases/<版本>/ 这一层，
# 所以这里从同一个 base 直接取 latest.json 与 tarball。
#
# 用法：
#   ./install-from-release.sh                 # 取最新 Release
#   ./install-from-release.sh v3.14.3         # 取指定 tag
#   ZCODE_RELEASE_REPO=owner/repo ./install-from-release.sh
#
# 环境变量（与 install.sh 同名，含义一致）：
#   ZCODE_DIST_HOME     安装目录，默认 ~/.zcode/runtime
#   ZCODE_DIST_BIN_DIR  命令目录，默认 ~/.local/bin
#   ZCODE_RELEASE_REPO  资产来源仓库，默认 emf37/ZCode
set -eu

REPO="${ZCODE_RELEASE_REPO:-emf37/ZCode}"
TAG="${1:-latest}"

if [ "$TAG" = "latest" ]; then
  BASE_URL="https://github.com/$REPO/releases/latest/download"
else
  BASE_URL="https://github.com/$REPO/releases/download/$TAG"
fi

INSTALL_DIR="${ZCODE_DIST_HOME:-$HOME/.zcode/runtime}"
BIN_DIR="${ZCODE_DIST_BIN_DIR:-$HOME/.local/bin}"

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "zcode install requires $1" >&2
    exit 1
  fi
}

need_cmd node
need_cmd curl
need_cmd tar

LATEST_JSON="$(curl -fsSL "$BASE_URL/latest.json")"
VERSION="$(printf '%s' "$LATEST_JSON" | node -e "let data='';process.stdin.on('data',c=>data+=c);process.stdin.on('end',()=>process.stdout.write(JSON.parse(data).version))")"
TARBALL="$(printf '%s' "$LATEST_JSON" | node -e "let data='';process.stdin.on('data',c=>data+=c);process.stdin.on('end',()=>process.stdout.write(JSON.parse(data).tarball))")"
EXPECTED_SHA="$(printf '%s' "$LATEST_JSON" | node -e "let data='';process.stdin.on('data',c=>data+=c);process.stdin.on('end',()=>process.stdout.write(JSON.parse(data).sha256||''))")"

TMP_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

ARCHIVE="$TMP_DIR/$TARBALL"
curl -fL "$BASE_URL/$TARBALL" -o "$ARCHIVE"

# 资产清单里带 sha256 就校验；相比 install.sh 多这一步，因为直连 Release
# 没有托管侧的一致性保证。
if [ -n "$EXPECTED_SHA" ] && command -v sha256sum >/dev/null 2>&1; then
  ACTUAL_SHA="$(sha256sum "$ARCHIVE" | cut -d' ' -f1)"
  if [ "$ACTUAL_SHA" != "$EXPECTED_SHA" ]; then
    echo "校验失败：$TARBALL" >&2
    echo "  期望 $EXPECTED_SHA" >&2
    echo "  实际 $ACTUAL_SHA" >&2
    exit 1
  fi
  echo "sha256 校验通过。"
fi

mkdir -p "$INSTALL_DIR/releases" "$BIN_DIR"
TARGET="$INSTALL_DIR/releases/$VERSION"
rm -rf "$TARGET.new"
mkdir -p "$TARGET.new"
tar -xzf "$ARCHIVE" -C "$TARGET.new"
rm -rf "$TARGET"
mv "$TARGET.new/zcode" "$TARGET"
rm -rf "$TARGET.new"
ln -sfn "$TARGET" "$INSTALL_DIR/current"

cat > "$BIN_DIR/zcode" <<SH
#!/usr/bin/env sh
exec node "$INSTALL_DIR/current/bin/zcode.mjs" "\$@"
SH
chmod +x "$BIN_DIR/zcode"

echo "ZCode $VERSION installed."
echo "Run: zcode (TUI) or zcode --web (Web)"
case ":$PATH:" in
  *":$BIN_DIR:"*) ;;
  *) echo "Note: $BIN_DIR is not in PATH." ;;
esac
