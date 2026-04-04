"""
Model evaluation utilities for SDM pipeline.
Implements AUC, TSS, and spatial cross-validation.
"""

import numpy as np
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import KFold


def compute_auc(y_true, y_pred):
    """Compute Area Under the ROC Curve."""
    try:
        return roc_auc_score(y_true, y_pred)
    except ValueError:
        return np.nan


def compute_tss(y_true, y_pred, threshold=0.5):
    """
    Compute True Skill Statistic (TSS = Sensitivity + Specificity - 1).
    Ranges from -1 to 1, where 1 = perfect, 0 = random.
    """
    y_binary = (y_pred >= threshold).astype(int)

    tp = np.sum((y_binary == 1) & (y_true == 1))
    tn = np.sum((y_binary == 0) & (y_true == 0))
    fp = np.sum((y_binary == 1) & (y_true == 0))
    fn = np.sum((y_binary == 0) & (y_true == 1))

    sensitivity = tp / (tp + fn) if (tp + fn) > 0 else 0
    specificity = tn / (tn + fp) if (tn + fp) > 0 else 0

    return sensitivity + specificity - 1


def find_optimal_threshold(y_true, y_pred, metric='tss'):
    """
    Find the threshold that maximizes TSS (or other metric).
    """
    thresholds = np.arange(0.05, 0.95, 0.05)
    best_score = -999
    best_threshold = 0.5

    for t in thresholds:
        if metric == 'tss':
            score = compute_tss(y_true, y_pred, threshold=t)
        else:
            raise ValueError(f"Unknown metric: {metric}")

        if score > best_score:
            best_score = score
            best_threshold = t

    return best_threshold, best_score


def spatial_block_cv(coords, n_folds=5):
    """
    Create spatial block cross-validation folds.
    Divides the study area into spatial blocks and assigns to folds.

    Args:
        coords: Array of (lon, lat) coordinates
        n_folds: Number of CV folds

    Returns:
        List of (train_idx, test_idx) tuples
    """
    if len(coords) < n_folds:
        # Fall back to random CV for very small datasets
        kf = KFold(n_splits=min(n_folds, len(coords)), shuffle=True, random_state=42)
        return list(kf.split(coords))

    # Create spatial blocks by dividing longitude range into strips
    lon_min, lon_max = coords[:, 0].min(), coords[:, 0].max()
    lat_min, lat_max = coords[:, 1].min(), coords[:, 1].max()

    # Use checkerboard pattern for better spatial separation
    n_blocks_x = max(3, int(np.sqrt(n_folds * 2)))
    n_blocks_y = max(3, int(np.sqrt(n_folds * 2)))

    lon_edges = np.linspace(lon_min, lon_max + 0.001, n_blocks_x + 1)
    lat_edges = np.linspace(lat_min, lat_max + 0.001, n_blocks_y + 1)

    # Assign each point to a block
    lon_block = np.digitize(coords[:, 0], lon_edges) - 1
    lat_block = np.digitize(coords[:, 1], lat_edges) - 1
    block_id = lon_block * n_blocks_y + lat_block

    # Assign blocks to folds
    unique_blocks = np.unique(block_id)
    np.random.shuffle(unique_blocks)
    block_to_fold = {b: i % n_folds for i, b in enumerate(unique_blocks)}
    fold_assignment = np.array([block_to_fold[b] for b in block_id])

    folds = []
    for fold in range(n_folds):
        test_idx = np.where(fold_assignment == fold)[0]
        train_idx = np.where(fold_assignment != fold)[0]
        if len(test_idx) > 0 and len(train_idx) > 0:
            folds.append((train_idx, test_idx))

    if len(folds) == 0:
        # Fallback to random if spatial blocking failed
        kf = KFold(n_splits=n_folds, shuffle=True, random_state=42)
        return list(kf.split(coords))

    return folds


def evaluate_model(y_true, y_pred):
    """
    Compute all evaluation metrics.

    Returns:
        Dict with metric names and values
    """
    auc = compute_auc(y_true, y_pred)
    threshold, tss = find_optimal_threshold(y_true, y_pred, metric='tss')

    return {
        'auc': auc,
        'tss': tss,
        'threshold': threshold,
    }
