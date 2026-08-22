"""
Data loading, schema validation, and raw data hygiene module for AI Risk Manager.
"""

from pathlib import Path
from typing import Optional, Tuple, Union

import pandas as pd

from src.config import (
    ALL_RAW_COLUMNS,
    DATETIME_COLUMN,
    ID_COLUMNS,
    RAW_TRANSACTIONS_FILE,
    TARGET_COLUMN,
)
from src.utils import logger


def load_raw_data(filepath: Optional[Union[str, Path]] = None) -> pd.DataFrame:
    """
    Loads the raw financial transactions dataset from disk.
    
    Args:
        filepath: Path to the raw CSV file. Defaults to RAW_TRANSACTIONS_FILE.
        
    Returns:
        pd.DataFrame: Raw dataset copy.
    """
    path_obj = Path(filepath) if filepath else RAW_TRANSACTIONS_FILE
    if not path_obj.exists():
        raise FileNotFoundError(f"Raw dataset not found at {path_obj.resolve()}")
    
    logger.info(f"Loading raw dataset from {path_obj.resolve()}")
    df = pd.read_csv(path_obj)
    logger.info(f"Loaded {df.shape[0]:,} records with {df.shape[1]} columns.")
    return df


def validate_schema(df: pd.DataFrame, expected_columns: Optional[list] = None) -> bool:
    """
    Validates that all mandatory columns are present in the dataframe.
    
    Args:
        df: The dataframe to validate.
        expected_columns: List of expected column names. Defaults to ALL_RAW_COLUMNS.
        
    Returns:
        bool: True if schema is valid.
        
    Raises:
        ValueError: If any expected columns are missing.
    """
    cols = expected_columns or ALL_RAW_COLUMNS
    missing_cols = [col for col in cols if col not in df.columns]
    
    if missing_cols:
        error_msg = f"Schema validation failed. Missing columns: {missing_cols}"
        logger.error(error_msg)
        raise ValueError(error_msg)
    
    logger.info("Schema validation passed successfully.")
    return True


def clean_raw_data(df: pd.DataFrame, drop_duplicates: bool = True) -> pd.DataFrame:
    """
    Cleans raw data by dropping duplicate records and standardizing data types.
    Does NOT modify the raw file on disk.
    
    Args:
        df: Raw dataframe.
        drop_duplicates: Whether to remove duplicate transaction IDs and exact row duplicates.
        
    Returns:
        pd.DataFrame: Cleaned dataframe.
    """
    df_clean = df.copy()
    
    # Validate schema
    validate_schema(df_clean)
    
    # Handle duplicates
    if drop_duplicates:
        initial_len = len(df_clean)
        # Drop exact row duplicates
        df_clean = df_clean.drop_duplicates()
        # Drop duplicate transaction_id records keeping the first
        if "transaction_id" in df_clean.columns:
            df_clean = df_clean.drop_duplicates(subset=["transaction_id"], keep="first")
        removed_count = initial_len - len(df_clean)
        if removed_count > 0:
            logger.info(f"Removed {removed_count} duplicate record(s). Remaining: {len(df_clean):,} records.")
    
    # Parse timestamp
    if DATETIME_COLUMN in df_clean.columns:
        df_clean[DATETIME_COLUMN] = pd.to_datetime(df_clean[DATETIME_COLUMN], errors="coerce")
    
    # Cast target column if present
    if TARGET_COLUMN in df_clean.columns:
        df_clean[TARGET_COLUMN] = df_clean[TARGET_COLUMN].astype(int)
        
    return df_clean.reset_index(drop=True)


def split_features_and_target(
    df: pd.DataFrame, target_column: str = TARGET_COLUMN
) -> Tuple[pd.DataFrame, pd.Series]:
    """
    Separates the input feature matrix from the target label series.
    
    Args:
        df: Cleaned dataframe.
        target_column: Name of the target column.
        
    Returns:
        Tuple[pd.DataFrame, pd.Series]: (X, y)
    """
    if target_column not in df.columns:
        raise KeyError(f"Target column '{target_column}' not found in dataframe.")
    
    X = df.drop(columns=[target_column])
    y = df[target_column]
    logger.info(f"Separated features X ({X.shape}) and target y ({y.shape}). Fraud cases: {int(y.sum()):,} ({y.mean()*100:.2f}%)")
    return X, y


def load_and_clean_data(filepath: Optional[Union[str, Path]] = None) -> pd.DataFrame:
    """
    Convenience function to load and clean the dataset in one step.
    
    Args:
        filepath: Optional path to raw dataset.
        
    Returns:
        pd.DataFrame: Cleaned dataset.
    """
    raw_df = load_raw_data(filepath)
    clean_df = clean_raw_data(raw_df)
    return clean_df
