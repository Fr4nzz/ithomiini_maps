"""
Model evaluation utilities for SDM pipeline.
Implements AUC, TSS, Boyce index, and spatial cross-validation.
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
    """
    y_binary = (y_pred >= threshold).astype(int)
    tp = np.sum((y_binary == 1) & (y_true == 1))
    tn = np.sum((y_binary == 0) & (y_true == 0))
    fp = np.sum((y_binary == 1) & (y_true == 0))
    fn = np.sum((y_binary == 0) & (y_true == 1))
    sensitivity = tp / (tp + fn) if (tp + fn) > 0 else 0
    specificity = tn / (tn + fp) if (tn + fp) > 0 else 0
    return sensitivity + specificity - 1


def compute_boyce(y_pred_presence, y_pred_background, n_bins=10):
    """
    Compute the continuous Boyce index (Hirzel et al. 2006).
    Measures how well predictions correlate with observed presence frequency.

    A good model has Boyce > 0 (ideally close to 1).
    Random model → Boyce ≈ 0. Worse than random → Boyce < 0.

    Args:
        y_pred_presence: Predicted suitability values at presence locations
        y_pred_background: Predicted suitability values at background locations
        n_bins: Number of bins for the moving window

    Returns:
        Continuous Boyce index (Spearman correlation of P/E ratio with bin midpoints)
    """
    from scipy.stats import spearmanr

    if len(y_pred_presence) < 5:
        return np.nan

    # Combine all predictions for binning
    all_preds = np.concatenate([y_pred_presence, y_pred_background])
    all_preds = all_preds[~np.isnan(all_preds)]

    if len(all_preds) == 0:
        return np.nan

    # Create overlapping bins using moving window
    bin_edges = np.linspace(all_preds.min(), all_preds.max(), n_bins + 1)
    bin_width = (all_preds.max() - all_preds.min()) / n_bins

    pe_ratios = []
    bin_midpoints = []

    for i in range(n_bins):
        lo = bin_edges[i]
        hi = bin_edges[i + 1] if i < n_bins - 1 else all_preds.max() + 0.001

        # Predicted frequency (proportion of presence points in this bin)
        n_pres_in_bin = np.sum((y_pred_presence >= lo) & (y_pred_presence < hi))
        p_freq = n_pres_in_bin / len(y_pred_presence) if len(y_pred_presence) > 0 else 0

        # Expected frequency (proportion of all points in this bin)
        n_all_in_bin = np.sum((all_preds >= lo) & (all_preds < hi))
        e_freq = n_all_in_bin / len(all_preds) if len(all_preds) > 0 else 0

        if e_freq > 0:
            pe_ratios.append(p_freq / e_freq)
            bin_midpoints.append((lo + hi) / 2)

    if len(pe_ratios) < 3:
        return np.nan

    # Spearman correlation between P/E ratio and bin midpoints
    corr, _ = spearmanr(bin_midpoints, pe_ratios)
    return corr if not np.isnan(corr) else 0.0


def find_optimal_threshold(y_true, y_pred, metric='tss'):
    """Find the threshold that maximizes TSS."""
    thresholds = np.arange(0.05, 0.95, 0.05)
    best_score = -999
    best_threshold = 0.5

    for t in thresholds:
        score = compute_tss(y_true, y_pred, threshold=t)
        if score > best_score:
            best_score = score
            best_threshold = t

    return best_threshold, best_score


def spatial_block_cv(coords, n_folds=5):
    """
    Create spatial block cross-validation folds.
    """
    if len(coords) < n_folds:
        kf = KFold(n_splits=min(n_folds, len(coords)), shuffle=True, random_state=42)
        return list(kf.split(coords))

    lon_min, lon_max = coords[:, 0].min(), coords[:, 0].max()
    lat_min, lat_max = coords[:, 1].min(), coords[:, 1].max()

    n_blocks_x = max(3, int(np.sqrt(n_folds * 2)))
    n_blocks_y = max(3, int(np.sqrt(n_folds * 2)))

    lon_edges = np.linspace(lon_min, lon_max + 0.001, n_blocks_x + 1)
    lat_edges = np.linspace(lat_min, lat_max + 0.001, n_blocks_y + 1)

    lon_block = np.digitize(coords[:, 0], lon_edges) - 1
    lat_block = np.digitize(coords[:, 1], lat_edges) - 1
    block_id = lon_block * n_blocks_y + lat_block

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
        kf = KFold(n_splits=n_folds, shuffle=True, random_state=42)
        return list(kf.split(coords))

    return folds


def evaluate_model(y_true, y_pred):
    """
    Compute all evaluation metrics including Boyce index.
    """
    auc = compute_auc(y_true, y_pred)
    threshold, tss = find_optimal_threshold(y_true, y_pred, metric='tss')

    # Boyce index: separate presence and background predictions
    pres_mask = y_true == 1
    boyce = compute_boyce(y_pred[pres_mask], y_pred[~pres_mask])

    return {
        'auc': auc,
        'tss': tss,
        'boyce': boyce,
        'threshold': threshold,
    }
