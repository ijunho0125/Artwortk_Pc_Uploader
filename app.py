from __future__ import annotations

import os
import socket
import uuid
import warnings
from datetime import datetime
from pathlib import Path

from flask import Flask, jsonify, render_template, request
from PIL import Image, UnidentifiedImageError
from werkzeug.exceptions import RequestEntityTooLarge
from werkzeug.utils import secure_filename


BASE_DIR = Path(__file__).resolve().parent
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "webp", "gif"}
ALLOWED_DESTINATIONS = {
    "input_sprites": BASE_DIR / "input_sprites",
    "uploads": BASE_DIR / "uploads",
}
MAX_UPLOAD_MB = int(os.environ.get("MAX_UPLOAD_MB", "32"))

Image.MAX_IMAGE_PIXELS = 40_000_000
warnings.simplefilter("error", Image.DecompressionBombWarning)

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = MAX_UPLOAD_MB * 1024 * 1024

for folder in ALLOWED_DESTINATIONS.values():
    folder.mkdir(parents=True, exist_ok=True)


def extension_of(filename: str) -> str:
    return Path(filename).suffix.lower().lstrip(".")


def unique_filename(original_name: str, extension: str) -> str:
    safe_name = secure_filename(original_name)
    safe_stem = Path(safe_name).stem or "image"
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    return f"{safe_stem}_{timestamp}_{uuid.uuid4().hex[:8]}.{extension}"


def validate_image(path: Path) -> None:
    with Image.open(path) as image:
        image.verify()


def local_ip_address() -> str:
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.connect(("10.255.255.255", 1))
        return sock.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        sock.close()


@app.get("/")
def index():
    return render_template(
        "index.html",
        max_upload_mb=MAX_UPLOAD_MB,
        allowed_extensions=", ".join(sorted(ALLOWED_EXTENSIONS)),
    )


@app.get("/health")
def health():
    return jsonify(status="ok")


@app.post("/upload")
def upload():
    destination_name = request.form.get("destination", "input_sprites")
    destination = ALLOWED_DESTINATIONS.get(destination_name)
    if destination is None:
        return jsonify(message="허용되지 않은 저장 폴더입니다."), 400

    files = request.files.getlist("images")
    if not files or all(not item.filename for item in files):
        return jsonify(message="업로드할 이미지를 선택해 주세요."), 400

    saved = []
    rejected = []

    for uploaded in files:
        original_name = uploaded.filename or ""
        extension = extension_of(original_name)

        if not original_name:
            rejected.append({"name": "이름 없는 파일", "reason": "파일명이 없습니다."})
            continue
        if extension not in ALLOWED_EXTENSIONS:
            rejected.append(
                {
                    "name": original_name,
                    "reason": f"허용되지 않은 확장자입니다: .{extension or '(없음)'}",
                }
            )
            continue

        final_name = unique_filename(original_name, extension)
        final_path = destination / final_name
        temp_path = destination / f".{uuid.uuid4().hex}.uploading"

        try:
            uploaded.save(temp_path)
            validate_image(temp_path)
            os.replace(temp_path, final_path)
            saved.append(
                {
                    "originalName": original_name,
                    "savedName": final_name,
                    "folder": destination_name,
                }
            )
        except (
            UnidentifiedImageError,
            OSError,
            SyntaxError,
            Image.DecompressionBombError,
            Image.DecompressionBombWarning,
        ) as exc:
            temp_path.unlink(missing_ok=True)
            rejected.append(
                {
                    "name": original_name,
                    "reason": "손상되었거나 실제 이미지가 아닌 파일입니다.",
                }
            )
            app.logger.warning("Rejected image %s: %s", original_name, exc)
        except Exception:
            temp_path.unlink(missing_ok=True)
            app.logger.exception("Failed to save %s", original_name)
            rejected.append({"name": original_name, "reason": "저장 중 오류가 발생했습니다."})

    if saved and not rejected:
        status_code = 201
        message = f"이미지 {len(saved)}장을 저장했습니다."
    elif saved:
        status_code = 207
        message = f"{len(saved)}장은 저장했고, {len(rejected)}장은 제외했습니다."
    else:
        status_code = 400
        message = "저장된 이미지가 없습니다."

    return jsonify(message=message, saved=saved, rejected=rejected), status_code


@app.errorhandler(RequestEntityTooLarge)
def upload_too_large(_error):
    return (
        jsonify(message=f"한 번에 업로드할 수 있는 전체 크기는 {MAX_UPLOAD_MB}MB까지입니다."),
        413,
    )


if __name__ == "__main__":
    host = "0.0.0.0"
    port = int(os.environ.get("PORT", "5000"))
    ip = local_ip_address()
    print("\nHop Hop 이미지 전송 서버가 시작됩니다.")
    print(f"PC에서 확인:     http://127.0.0.1:{port}")
    print(f"태블릿에서 접속: http://{ip}:{port}\n")
    app.run(host=host, port=port, debug=False)
