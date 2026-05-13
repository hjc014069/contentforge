"""
두 sprite sheet에서 프레임을 골라 합치는 유틸 스크립트

사용법:
1. 1번 이미지(원본)와 2번 이미지(Frame 4 출처)를 같은 폴더에 저장
2. 아래 INPUT_1, INPUT_2 변수에 파일 경로 적기
3. python combine_walk_sprite.py 실행
4. output.png가 같은 폴더에 생성됨

기본 동작: 1번 이미지에서 Frame 1, 2, 3 + 2번 이미지에서 Frame 4 = 새 sprite sheet
"""

from PIL import Image
import sys
from pathlib import Path

# ===== 설정 =====
INPUT_1 = "walk_side_v1.png"   # Frame 1, 2, 3을 가져올 이미지
INPUT_2 = "walk_side_v2.png"   # Frame 4를 가져올 이미지
OUTPUT = "walk_side.png"

# 각 이미지에서 가져올 프레임 인덱스 (0부터 시작)
FRAMES_FROM_1 = [0, 1, 2]      # 1번 이미지의 Frame 1, 2, 3
FRAMES_FROM_2 = [3]            # 2번 이미지의 Frame 4

# 전체 프레임 수
TOTAL_FRAMES = 4
# ================


def extract_frame(img: Image.Image, frame_index: int, total_frames: int) -> Image.Image:
    """가로로 분할된 sprite sheet에서 특정 프레임 추출"""
    frame_w = img.width // total_frames
    box = (frame_w * frame_index, 0, frame_w * (frame_index + 1), img.height)
    return img.crop(box)


def main():
    # 입력 파일 확인
    if not Path(INPUT_1).exists():
        print(f"❌ {INPUT_1} 파일이 없습니다. 같은 폴더에 두세요.")
        sys.exit(1)
    if not Path(INPUT_2).exists():
        print(f"❌ {INPUT_2} 파일이 없습니다. 같은 폴더에 두세요.")
        sys.exit(1)

    img1 = Image.open(INPUT_1).convert("RGBA")
    img2 = Image.open(INPUT_2).convert("RGBA")

    print(f"이미지 1: {img1.size}")
    print(f"이미지 2: {img2.size}")

    # 1번 이미지 기준으로 프레임 사이즈 결정
    frame_w = img1.width // TOTAL_FRAMES
    frame_h = img1.height

    # 결과 이미지 (흰 배경)
    result = Image.new("RGBA", (frame_w * TOTAL_FRAMES, frame_h), (255, 255, 255, 255))

    # 출력 프레임 순서 (사용자 의도: 1번 1, 2, 3 + 2번 4 → 합쳐서 1, 2, 3, 4 위치에)
    output_frames = []
    for i in FRAMES_FROM_1:
        f = extract_frame(img1, i, TOTAL_FRAMES)
        output_frames.append(f)
    for i in FRAMES_FROM_2:
        f = extract_frame(img2, i, TOTAL_FRAMES)
        # 2번 이미지의 프레임 사이즈가 다르면 리사이즈
        if f.size != (frame_w, frame_h):
            f = f.resize((frame_w, frame_h), Image.LANCZOS)
        output_frames.append(f)

    # 가로로 이어 붙이기
    for i, f in enumerate(output_frames):
        result.paste(f, (frame_w * i, 0), f if f.mode == "RGBA" else None)

    result.save(OUTPUT, "PNG")
    print(f"✅ 합치기 완료 → {OUTPUT}")


if __name__ == "__main__":
    main()
