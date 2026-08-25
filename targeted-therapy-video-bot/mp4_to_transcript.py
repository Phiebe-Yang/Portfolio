#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
mp4_to_transcript.py
給一個 mp4（或 mp3/wav/mov 等任何 ffmpeg 支援的格式），
用 faster-whisper 產生逐字稿（.srt 字幕檔 + 純文字 .txt）。

安裝（在你自己的電腦，非此聊天環境）：
    pip install faster-whisper opencc-python-reimplemented tqdm
    （tqdm 是進度條用的，非必要；沒裝的話會改用文字百分比顯示進度）

    若要用 GPU 加速，另外裝：
    pip install nvidia-cublas-cu12 nvidia-cudnn-cu12
    （有顯卡不代表有 CUDA/cuBLAS 函式庫，這兩個套件才是關鍵；
      沒裝也沒關係，程式會自動退回 CPU 執行，只是比較慢）

用法：
    python mp4_to_transcript.py 會議錄影.mp4
    （預設已使用最準的 large-v3 模型；若電腦記憶體/VRAM不足或想跑快一點，可加 --model medium）
    python mp4_to_transcript.py 會議錄影.mp4 --model medium --device cpu

輸出：
    會議錄影.srt   （帶時間軸的字幕檔）
    會議錄影.txt   （純文字逐字稿，含時間戳）
"""

import argparse
import os
import sys
from pathlib import Path


def setup_windows_cuda_dlls():
    """
    Windows 上常見的 cublas64_12.dll / cudnn 找不到的問題。
    自動偵測 pip 裝的 nvidia-cublas-cu12 / nvidia-cudnn-cu12 套件位置，
    掛進 DLL 搜尋路徑，讓 GPU 真正能用（而不是靜靜 fallback 成 CPU）。
    """
    if sys.platform != "win32":
        return
    if not hasattr(os, "add_dll_directory"):
        return
    try:
        import importlib.util
        for pkg in ("nvidia.cublas.lib", "nvidia.cudnn.lib"):
            spec = importlib.util.find_spec(pkg)
            if spec and spec.submodule_search_locations:
                for loc in spec.submodule_search_locations:
                    if os.path.isdir(loc):
                        os.add_dll_directory(loc)
    except Exception as e:
        print(f"[提醒] 自動掛載 CUDA DLL 路徑時發生小狀況（不影響 CPU 執行）：{e}")


def format_timestamp(seconds: float) -> str:
    ms = int(round(seconds * 1000))
    h, ms = divmod(ms, 3_600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def to_traditional(text: str) -> str:
    try:
        from opencc import OpenCC
        cc = OpenCC("s2t")
        return cc.convert(text)
    except Exception:
        return text  # 沒裝 opencc 就跳過簡轉繁


def _make_progress_bar(total_seconds: float):
    """回傳一個 update(seconds_done) 函式；有 tqdm 就用進度條，沒有就用簡單文字列印。"""
    try:
        from tqdm import tqdm
        bar = tqdm(total=round(total_seconds, 1), unit="秒(音檔時長)", ncols=90)

        def update(done_seconds):
            bar.n = min(round(done_seconds, 1), bar.total)
            bar.refresh()

        def close():
            bar.close()

        return update, close
    except ImportError:
        state = {"last_pct": -1}

        def update(done_seconds):
            pct = int(done_seconds / total_seconds * 100) if total_seconds else 0
            if pct != state["last_pct"]:
                state["last_pct"] = pct
                print(f"\r進度：{pct:3d}%（{done_seconds:.0f}s / {total_seconds:.0f}s）", end="", flush=True)

        def close():
            print()

        return update, close


def _run_model(model, input_path: Path, lang: str):
    segments_gen, info = model.transcribe(
        str(input_path),
        language=lang if lang != "auto" else None,
        vad_filter=True,
    )
    # 取出第一段，讓 CUDA/cuDNN 這類錯誤在這裡就先爆出來，
    # 而不是等到整份跑完才發現失敗（faster-whisper 是惰性/邊跑邊產生的）。
    first = next(segments_gen, None)

    def full_stream():
        if first is not None:
            yield first
        yield from segments_gen

    return full_stream(), info


def transcribe_and_write(input_path: Path, model_size: str, device: str, lang: str, out_base: Path):
    from faster_whisper import WhisperModel

    setup_windows_cuda_dlls()

    def load_model(dev: str):
        compute_type = "float16" if dev == "cuda" else "int8"
        return WhisperModel(model_size, device=dev, compute_type=compute_type)

    try:
        if device == "auto":
            try:
                model = load_model("cuda")
                device = "cuda"
            except Exception:
                print("[提醒] GPU 不可用，改用 CPU（速度會慢一些）")
                model = load_model("cpu")
                device = "cpu"
        else:
            model = load_model(device)

        stream, info = _run_model(model, input_path, lang)
    except Exception as e:
        if device != "cpu":
            print(f"[提醒] {device} 執行失敗（{e}），改用 CPU 重試")
            model = load_model("cpu")
            stream, info = _run_model(model, input_path, lang)
            device = "cpu"
        else:
            raise

    print(f"偵測語言：{info.language}（信心值 {info.language_probability:.2f}）")
    total_seconds = getattr(info, "duration", 0) or 0
    print(f"音檔總長：約 {total_seconds:.0f} 秒，開始逐段轉錄（裝置：{device}）...")

    update_progress, close_progress = _make_progress_bar(total_seconds)

    srt_path = out_base.with_suffix(".srt")
    txt_path = out_base.with_suffix(".txt")

    count = 0
    with srt_path.open("w", encoding="utf-8") as f_srt, \
         txt_path.open("w", encoding="utf-8") as f_txt:
        for i, seg in enumerate(stream, start=1):
            text = to_traditional(seg.text.strip())
            start, end = format_timestamp(seg.start), format_timestamp(seg.end)

            f_srt.write(f"{i}\n{start} --> {end}\n{text}\n\n")
            f_txt.write(f"[{start} --> {end}]  {text}\n")
            f_txt.flush()  # 讓你可以邊跑邊用文字編輯器打開 txt 看目前進度

            update_progress(seg.end)
            count = i

    close_progress()
    print(f"共產生 {count} 段字幕")
    return srt_path, txt_path


def main():
    parser = argparse.ArgumentParser(description="mp4/mp3/wav → Whisper 逐字稿")
    parser.add_argument("input", help="輸入影音檔路徑（mp4/mp3/wav/mov 皆可）")
    parser.add_argument("--model", default="large-v3",
                         help="Whisper 模型大小：tiny/base/small/medium/large-v3（預設 large-v3，最準但最慢，需要較多記憶體/VRAM）")
    parser.add_argument("--device", default="auto", choices=["auto", "cuda", "cpu"],
                         help="運算裝置（預設 auto：優先用 GPU，失敗自動退回 CPU）")
    parser.add_argument("--lang", default="zh",
                         help="語言代碼，例如 zh/en，或 auto 自動偵測（預設 zh）")
    args = parser.parse_args()

    input_path = Path(args.input)
    if not input_path.exists():
        print(f"錯誤：找不到檔案 {input_path}")
        sys.exit(1)

    print(f"開始轉錄：{input_path}（模型：{args.model}，裝置：{args.device}）")
    srt_path, txt_path = transcribe_and_write(
        input_path, args.model, args.device, args.lang, input_path.with_suffix("")
    )

    print(f"完成！\n  SRT：{srt_path}\n  TXT：{txt_path}")


if __name__ == "__main__":
    main()