"""
Consolidates raw Kaggle downloads in dataset/ into a single, balanced,
train/val/test folder structure for Stage 2 material-classifier training.

Sources:
  dataset/data/{train,val,test}/<18 Kaggle e-waste classes>/*.jpg
  dataset/dataset_pc_parts/{cables,monitor}/*.jpg   (no pre-existing split)

Output:
  dataset/material_dataset/{train,val,test}/<7 MATERIAL_CLASSES>/*.jpg

Mapping and per-class caps were agreed with the user in conversation:
MOTOR and MAGNET are dropped (no usable source imagery for this pilot).
Files are hardlinked where possible (same-volume, near-zero disk cost)
and fall back to a copy otherwise.
"""
import os
import random
import shutil
from pathlib import Path

SEED = 42
ROOT = Path(__file__).resolve().parent.parent
KAGGLE_DIR = ROOT / "dataset" / "data"
PCPARTS_DIR = ROOT / "dataset" / "dataset_pc_parts"
OUT_DIR = ROOT / "dataset" / "material_dataset"

# Kaggle class -> MATERIAL_CLASSES bucket (MOTOR, MAGNET intentionally absent)
KAGGLE_CLASS_MAP = {
    "Battery": "BATTERY",
    "PCB": "PCB",
    "Microchip-IC": "PCB",
    "Passive-Component": "PCB",
    "Resistor": "PCB",
    "transistor": "PCB",
    "Television": "CRT",
    "Keyboard": "PLASTIC",
    "Mouse": "PLASTIC",
    "Printer": "PLASTIC",
    "Laptop": "OTHER",
    "Mobile": "OTHER",
    "Air-Conditioner": "OTHER",
    "Microwave": "OTHER",
    "Refrigerator": "OTHER",
    "Washing Machine": "OTHER",
    "heat-sink": "OTHER",
    "light bulbs": "OTHER",
}

# PC Parts class -> MATERIAL_CLASSES bucket (no pre-existing split; we split below)
PCPARTS_CLASS_MAP = {
    "cables": "CABLE",
    "monitor": "LCD",
}

MAX_PER_CLASS = {"train": 1500, "val": 200, "test": 200}
PCPARTS_SPLIT_RATIOS = {"train": 0.8, "val": 0.1, "test": 0.1}

IMG_EXTS = {".jpg", ".jpeg", ".png"}


def link_or_copy(src: Path, dst: Path) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    if dst.exists():
        return
    try:
        os.link(src, dst)
    except OSError:
        shutil.copy2(src, dst)


def place_files(tagged_files, split: str, material_class: str, cap: int, rng: random.Random) -> int:
    """tagged_files: list of (source_tag, Path). Cap applies to the combined pool."""
    tagged_files = sorted(tagged_files, key=lambda t: (t[0], t[1].name))
    if len(tagged_files) > cap:
        tagged_files = rng.sample(tagged_files, cap)
    for source_tag, f in tagged_files:
        dst = OUT_DIR / split / material_class / f"{source_tag}__{f.name}"
        link_or_copy(f, dst)
    return len(tagged_files)


def main() -> None:
    rng = random.Random(SEED)
    counts = {}
    # (split, material_class) -> list of (source_tag, Path)
    pooled = {}

    for split in ("train", "val", "test"):
        for kaggle_class, material_class in KAGGLE_CLASS_MAP.items():
            src_dir = KAGGLE_DIR / split / kaggle_class
            if not src_dir.is_dir():
                print(f"WARNING: missing {src_dir}, skipping")
                continue
            files = [p for p in src_dir.iterdir() if p.suffix.lower() in IMG_EXTS]
            tag = kaggle_class.replace(" ", "_")
            pooled.setdefault((split, material_class), []).extend((tag, f) for f in files)

    for pcparts_class, material_class in PCPARTS_CLASS_MAP.items():
        src_dir = PCPARTS_DIR / pcparts_class
        if not src_dir.is_dir():
            print(f"WARNING: missing {src_dir}, skipping")
            continue
        files = sorted(p for p in src_dir.iterdir() if p.suffix.lower() in IMG_EXTS)
        rng.shuffle(files)
        n_total = len(files)
        n_train = int(n_total * PCPARTS_SPLIT_RATIOS["train"])
        n_val = int(n_total * PCPARTS_SPLIT_RATIOS["val"])
        splits = {
            "train": files[:n_train],
            "val": files[n_train:n_train + n_val],
            "test": files[n_train + n_val:],
        }
        for split, split_files in splits.items():
            pooled.setdefault((split, material_class), []).extend((pcparts_class, f) for f in split_files)

    if OUT_DIR.exists():
        shutil.rmtree(OUT_DIR)

    for (split, material_class), tagged_files in pooled.items():
        n = place_files(tagged_files, split, material_class, MAX_PER_CLASS[split], rng)
        counts[(split, material_class)] = n

    print("\nFinal per-class counts:")
    material_classes = sorted({m for m in list(KAGGLE_CLASS_MAP.values()) + list(PCPARTS_CLASS_MAP.values())})
    header = f"{'class':<10}" + "".join(f"{s:>8}" for s in ("train", "val", "test"))
    print(header)
    for m in material_classes:
        row = f"{m:<10}" + "".join(f"{counts.get((s, m), 0):>8}" for s in ("train", "val", "test"))
        print(row)


if __name__ == "__main__":
    main()
