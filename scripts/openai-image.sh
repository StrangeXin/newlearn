#!/usr/bin/env bash
# openai-image.sh — 通过 OpenAI 兼容接口用 curl 生成 / 编辑图片
# 依赖：curl、base64、grep、sed（macOS / Linux 自带，无需安装任何环境）
#
# 用法：
#   生成（文生图）：
#     openai-image.sh generate --prompt "一只戴贝雷帽的小水獭" \
#       [--model gpt-image-2] [--size 1024x1024] [--n 1] [--quality auto] [--out 路径.png]
#   编辑 / 图生图：
#     openai-image.sh edit --prompt "把背景换成雪山" --image in.png \
#       [--image 第二张.png ...] [--mask mask.png] \
#       [--model gpt-image-2] [--size 1024x1024] [--n 1] [--out 路径.png]
#
# 配置：默认读取项目根目录 .env 中的 IMAGE_BASE_URL 和 IMAGE_API_KEY
#       （兼容 base_url/api_key；可用环境变量 OPENAI_IMAGE_ENV 覆盖配置文件路径）

set -euo pipefail

ENV_FILE="${OPENAI_IMAGE_ENV:-$(pwd)/.env}"
DEFAULT_MODEL="gpt-image-2"

err() { printf '%s\n' "$*" >&2; }

# ---------- 读取配置 ----------
read_cfg() {
  # 读取 key=value，忽略前后空白与包裹的引号；找不到时安全返回空
  local key="$1" line
  [ -f "$ENV_FILE" ] || return 0
  line="$(grep -E "^[[:space:]]*${key}[[:space:]]*=" "$ENV_FILE" 2>/dev/null | head -1)" || return 0
  [ -n "$line" ] || return 0
  line="${line#*=}"                                              # 去掉 key= 前缀
  line="$(printf '%s' "$line" | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//')"  # 先去首尾空白
  line="$(printf '%s' "$line" | sed -E 's/^"(.*)"$/\1/; s/^'\''(.*)'\''$/\1/')"  # 再去包裹引号
  printf '%s' "$line"
}

BASE_URL="${IMAGE_BASE_URL:-$(read_cfg IMAGE_BASE_URL)}"
API_KEY="${IMAGE_API_KEY:-$(read_cfg IMAGE_API_KEY)}"

# 兼容 codexzh-image skill 的原始配置键。
[ -n "$BASE_URL" ] || BASE_URL="$(read_cfg base_url)"
[ -n "$API_KEY" ] || API_KEY="$(read_cfg api_key)"

if [ -z "$BASE_URL" ] || [ -z "$API_KEY" ]; then
  err "❌ 未在 $ENV_FILE 中找到 IMAGE_BASE_URL 或 IMAGE_API_KEY。"
  err ""
  err "请在该文件中补充以下两行（任选一个 IMAGE_BASE_URL，或填你自己的）："
  err "  IMAGE_BASE_URL=https://api.codexzh.com/v1"
  err "  IMAGE_API_KEY=sk-你的密钥"
  err ""
  err "也兼容旧键：base_url / api_key"
  exit 2
fi

# 去掉 base_url 结尾多余的斜杠
BASE_URL="${BASE_URL%/}"

# ---------- 解析参数 ----------
MODE="${1:-}"; shift || true
PROMPT=""; MODEL="$DEFAULT_MODEL"; SIZE="1024x1024"; N="1"; QUALITY=""; OUT=""
MASK=""; IMAGES=()

while [ $# -gt 0 ]; do
  case "$1" in
    --prompt)  PROMPT="$2"; shift 2 ;;
    --model)   MODEL="$2"; shift 2 ;;
    --size)    SIZE="$2"; shift 2 ;;
    --n)       N="$2"; shift 2 ;;
    --quality) QUALITY="$2"; shift 2 ;;
    --out)     OUT="$2"; shift 2 ;;
    --mask)    MASK="$2"; shift 2 ;;
    --image)   IMAGES+=("$2"); shift 2 ;;
    *) err "未知参数：$1"; exit 2 ;;
  esac
done

[ -n "$PROMPT" ] || { err "缺少 --prompt"; exit 2; }

# 输出文件名（默认按时间戳放当前目录）
if [ -z "$OUT" ]; then
  OUT="./image-$(date +%Y%m%d-%H%M%S).png"
fi
OUT_DIR="$(dirname "$OUT")"
mkdir -p "$OUT_DIR"

TMP="$(mktemp -t openai-image.XXXXXX.json)"
trap 'rm -f "$TMP"' EXIT

# ---------- JSON 字符串转义（仅生成接口用）----------
json_escape() {
  printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' | tr '\n' ' '
}

# ---------- 处理响应里的图片 ----------
output_path_for_index() {
  local i="$1" name ext base suffix
  name="${OUT##*/}"
  suffix=""
  if [ "$name" != "${name%.*}" ]; then
    ext="${OUT##*.}"
    base="${OUT%.*}"
    suffix=".$ext"
  else
    base="$OUT"
  fi
  if [ "$i" -eq 0 ]; then
    printf '%s' "$OUT"
  else
    printf '%s_%s%s' "$base" "$i" "$suffix"
  fi
}

json_unescape_url() {
  # curl only needs the common JSON escapes that appear in URLs from these APIs.
  printf '%s' "$1" | sed -E 's#\\/#/#g; s#\\u0026#\&#g'
}

commit_image_file() {
  local tmp_file="$1" final_file="$2"
  if [ ! -s "$tmp_file" ]; then
    rm -f "$tmp_file"
    err "❌ 保存失败：生成的文件为空：$final_file"
    return 1
  fi
  mv "$tmp_file" "$final_file"
  printf '✅ 已保存：%s\n' "$final_file"
}

save_b64_image() {
  local b64="$1" final_file="$2" tmp_file
  tmp_file="$(mktemp "${final_file}.XXXXXX")"
  if printf '%s' "$b64" | base64 -d > "$tmp_file" 2>/dev/null; then
    :
  elif printf '%s' "$b64" | base64 -D > "$tmp_file" 2>/dev/null; then
    :
  else
    rm -f "$tmp_file"
    err "❌ Base64 解码失败：$final_file"
    return 1
  fi
  commit_image_file "$tmp_file" "$final_file"
}

save_url_image() {
  local url="$1" final_file="$2" tmp_file
  tmp_file="$(mktemp "${final_file}.XXXXXX")"
  if ! curl -fsSL "$url" -o "$tmp_file"; then
    rm -f "$tmp_file"
    err "❌ URL 下载失败：$url"
    return 1
  fi
  commit_image_file "$tmp_file" "$final_file"
}

extract_json_field() {
  local obj="$1" field="$2" match
  match="$(
    printf '%s' "$obj" \
      | grep -o "\"$field\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" \
      | head -1
  )" || true
  [ -n "$match" ] || return 0
  printf '%s' "$match" | sed -E "s/.*\"$field\"[[:space:]]*:[[:space:]]*\"//; s/\"$//"
}

save_outputs() {
  local resp="$1" compact objects i obj b64 url f
  compact="$(tr -d '\n' < "$resp")"
  objects="$(printf '%s' "$compact" | grep -o '{[^{}]*}' || true)"
  i=0

  if [ -n "$objects" ]; then
    while IFS= read -r obj; do
      [ -n "$obj" ] || continue
      b64="$(extract_json_field "$obj" "b64_json")"
      url="$(extract_json_field "$obj" "url")"
      f="$(output_path_for_index "$i")"

      if [ -n "$b64" ]; then
        save_b64_image "$b64" "$f" || exit 1
        i=$((i+1))
      elif [ -n "$url" ]; then
        url="$(json_unescape_url "$url")"
        save_url_image "$url" "$f" || exit 1
        i=$((i+1))
      fi
    done <<EOF
$objects
EOF
  fi

  if [ "$i" -eq 0 ]; then
    err "❌ 接口返回异常，原始响应："
    cat "$resp" >&2
    exit 1
  fi
}

# ---------- 调用接口 ----------
case "$MODE" in
  generate)
    esc="$(json_escape "$PROMPT")"
    body="$(printf '{"model":"%s","prompt":"%s","n":%s,"size":"%s"' "$MODEL" "$esc" "$N" "$SIZE")"
    [ -n "$QUALITY" ] && body="${body},\"quality\":\"${QUALITY}\""
    body="${body}}"
    curl -sS "$BASE_URL/images/generations" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $API_KEY" \
      -d "$body" -o "$TMP"
    ;;
  edit)
    [ "${#IMAGES[@]}" -gt 0 ] || { err "edit 模式至少需要一个 --image"; exit 2; }
    args=( -sS "$BASE_URL/images/edits"
           -H "Authorization: Bearer $API_KEY"
           -F "model=$MODEL"
           -F "prompt=$PROMPT"
           -F "n=$N"
           -F "size=$SIZE" )
    for img in "${IMAGES[@]}"; do
      [ -f "$img" ] || { err "图片不存在：$img"; exit 2; }
      # gpt-image 系列用 image[]，多图支持；dall-e-2 也兼容
      args+=( -F "image[]=@${img}" )
    done
    [ -n "$MASK" ] && args+=( -F "mask=@${MASK}" )
    [ -n "$QUALITY" ] && args+=( -F "quality=$QUALITY" )
    curl "${args[@]}" -o "$TMP"
    ;;
  *)
    err "用法：openai-image.sh {generate|edit} --prompt \"...\" [选项]"
    exit 2
    ;;
esac

# ---------- 出错检测 ----------
if grep -q '"error"' "$TMP" && ! grep -q '"b64_json"\|"url"' "$TMP"; then
  err "❌ 接口报错："
  cat "$TMP" >&2
  exit 1
fi

save_outputs "$TMP"
