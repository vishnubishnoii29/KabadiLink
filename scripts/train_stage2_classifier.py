"""
Fine-tunes MobileNetV2 (torchvision, ImageNet-pretrained) on dataset/material_dataset/
to produce backend/models/stage2_classifier.onnx per 03-ai-ml-pipeline.md's Stage 2 spec.

Framework note: the doc specifies TensorFlow/Keras for this stage, but TensorFlow dropped
native Windows GPU support after v2.10 (needs WSL2). This trains in PyTorch instead — same
ImageNet-pretrained MobileNetV2 backbone, exports straight to the ONNX file backend/inference.py
already expects. TFLite export (for the offline Flutter app) is a separate follow-up.

Class scope: 7 of the 9 MATERIAL_CLASSES (PCB, CABLE, BATTERY, LCD, CRT, PLASTIC, OTHER).
MOTOR and MAGNET are known gaps for this pilot — no usable source imagery existed for either
(see scripts/prepare_material_dataset.py's docstring). The exported label order is written to
backend/models/stage2_classifier_labels.json since it is NOT the full 9-class MATERIAL_CLASSES
list or its index order — callers must map model output indices through that file, not assume
positions line up with inference.py's MATERIAL_CLASSES.

Run: .venv/Scripts/python.exe scripts/train_stage2_classifier.py
"""
import json
import time
from pathlib import Path

import torch
import torch.nn as nn
from torch.utils.data import DataLoader
from torchvision import datasets, models, transforms

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "dataset" / "material_dataset"
MODELS_DIR = ROOT / "backend" / "models"
CHECKPOINT_DIR = ROOT / "dataset" / "checkpoints"

IMG_SIZE = 224
BATCH_SIZE = 32
HEAD_EPOCHS = 8
FINETUNE_EPOCHS = 6
HEAD_LR = 1e-3
FINETUNE_LR = 1e-4
NUM_WORKERS = 4

IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]

train_transform = transforms.Compose([
    transforms.RandomResizedCrop(IMG_SIZE, scale=(0.7, 1.0)),
    transforms.RandomHorizontalFlip(),
    transforms.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.2),
    transforms.ToTensor(),
    transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
])
eval_transform = transforms.Compose([
    transforms.Resize(int(IMG_SIZE * 1.14)),
    transforms.CenterCrop(IMG_SIZE),
    transforms.ToTensor(),
    transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
])


def build_dataloaders():
    train_ds = datasets.ImageFolder(DATA_DIR / "train", transform=train_transform)
    val_ds = datasets.ImageFolder(DATA_DIR / "val", transform=eval_transform)
    assert train_ds.classes == val_ds.classes, "train/val class folders must match"

    train_loader = DataLoader(train_ds, batch_size=BATCH_SIZE, shuffle=True,
                               num_workers=NUM_WORKERS, pin_memory=True)
    val_loader = DataLoader(val_ds, batch_size=BATCH_SIZE, shuffle=False,
                             num_workers=NUM_WORKERS, pin_memory=True)
    return train_ds, train_loader, val_loader


def class_weights(train_ds) -> torch.Tensor:
    counts = torch.zeros(len(train_ds.classes))
    for _, label in train_ds.samples:
        counts[label] += 1
    weights = counts.sum() / (len(counts) * counts)
    return weights


def run_epoch(model, loader, criterion, optimizer, device, train: bool):
    model.train(train)
    total_loss, correct, total = 0.0, 0, 0
    with torch.set_grad_enabled(train):
        for images, labels in loader:
            images, labels = images.to(device, non_blocking=True), labels.to(device, non_blocking=True)
            if train:
                optimizer.zero_grad()
            outputs = model(images)
            loss = criterion(outputs, labels)
            if train:
                loss.backward()
                optimizer.step()
            total_loss += loss.item() * images.size(0)
            correct += (outputs.argmax(1) == labels).sum().item()
            total += images.size(0)
    return total_loss / total, correct / total


def main():
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device} ({torch.cuda.get_device_name(0) if device.type == 'cuda' else 'CPU'})")

    train_ds, train_loader, val_loader = build_dataloaders()
    num_classes = len(train_ds.classes)
    print(f"Classes ({num_classes}): {train_ds.classes}")

    model = models.mobilenet_v2(weights=models.MobileNet_V2_Weights.IMAGENET1K_V1)
    model.classifier[1] = nn.Linear(model.last_channel, num_classes)
    model = model.to(device)

    weights = class_weights(train_ds).to(device)
    criterion = nn.CrossEntropyLoss(weight=weights)

    CHECKPOINT_DIR.mkdir(parents=True, exist_ok=True)
    best_val_acc = 0.0
    best_path = CHECKPOINT_DIR / "stage2_best.pt"

    # Phase 1: train the new head only, backbone frozen.
    for p in model.features.parameters():
        p.requires_grad = False
    optimizer = torch.optim.Adam(model.classifier.parameters(), lr=HEAD_LR)

    print("\n--- Phase 1: head-only training ---")
    for epoch in range(1, HEAD_EPOCHS + 1):
        t0 = time.time()
        train_loss, train_acc = run_epoch(model, train_loader, criterion, optimizer, device, train=True)
        val_loss, val_acc = run_epoch(model, val_loader, criterion, optimizer, device, train=False)
        print(f"[head {epoch}/{HEAD_EPOCHS}] train_loss={train_loss:.4f} train_acc={train_acc:.4f} "
              f"val_loss={val_loss:.4f} val_acc={val_acc:.4f} ({time.time()-t0:.0f}s)")
        if val_acc > best_val_acc:
            best_val_acc = val_acc
            torch.save({"model_state": model.state_dict(), "classes": train_ds.classes}, best_path)

    # Phase 2: unfreeze the whole backbone, fine-tune at a lower LR.
    for p in model.features.parameters():
        p.requires_grad = True
    optimizer = torch.optim.Adam(model.parameters(), lr=FINETUNE_LR)

    print("\n--- Phase 2: full fine-tuning ---")
    for epoch in range(1, FINETUNE_EPOCHS + 1):
        t0 = time.time()
        train_loss, train_acc = run_epoch(model, train_loader, criterion, optimizer, device, train=True)
        val_loss, val_acc = run_epoch(model, val_loader, criterion, optimizer, device, train=False)
        print(f"[finetune {epoch}/{FINETUNE_EPOCHS}] train_loss={train_loss:.4f} train_acc={train_acc:.4f} "
              f"val_loss={val_loss:.4f} val_acc={val_acc:.4f} ({time.time()-t0:.0f}s)")
        if val_acc > best_val_acc:
            best_val_acc = val_acc
            torch.save({"model_state": model.state_dict(), "classes": train_ds.classes}, best_path)

    print(f"\nBest val_acc={best_val_acc:.4f}, checkpoint at {best_path}")

    # Reload best checkpoint before exporting.
    checkpoint = torch.load(best_path, map_location=device)
    model.load_state_dict(checkpoint["model_state"])
    model.eval()

    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    onnx_path = MODELS_DIR / "stage2_classifier.onnx"
    dummy_input = torch.randn(1, 3, IMG_SIZE, IMG_SIZE, device=device)
    torch.onnx.export(
        model, dummy_input, str(onnx_path),
        input_names=["image"], output_names=["logits"],
        dynamic_axes={"image": {0: "batch"}, "logits": {0: "batch"}},
        opset_version=17,
    )
    print(f"Exported {onnx_path}")

    labels_path = MODELS_DIR / "stage2_classifier_labels.json"
    labels_path.write_text(json.dumps({
        "classes": checkpoint["classes"],
        "input_size": IMG_SIZE,
        "normalize_mean": IMAGENET_MEAN,
        "normalize_std": IMAGENET_STD,
        "note": "7 of 9 MATERIAL_CLASSES trained — MOTOR and MAGNET are known gaps for this pilot.",
    }, indent=2))
    print(f"Wrote {labels_path}")


if __name__ == "__main__":
    main()
