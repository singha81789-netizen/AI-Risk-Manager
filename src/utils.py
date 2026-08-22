"""
Utility functions for logging, directory validation, and object serialization.
"""

import json
import logging
from pathlib import Path
from typing import Any, Union

import joblib


def setup_logger(name: str = "ai_risk_manager", level: int = logging.INFO) -> logging.Logger:
    """Configures and returns a structured logger."""
    logger = logging.getLogger(name)
    if not logger.handlers:
        logger.setLevel(level)
        handler = logging.StreamHandler()
        formatter = logging.Formatter(
            "[%(asctime)s] [%(levelname)s] [%(name)s]: %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S"
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)
    return logger


logger = setup_logger()


def ensure_directory(path: Union[str, Path]) -> Path:
    """Ensures that a directory exists; creates it if necessary."""
    path_obj = Path(path)
    path_obj.mkdir(parents=True, exist_ok=True)
    return path_obj


def save_artifact(obj: Any, filepath: Union[str, Path]) -> Path:
    """Serializes and saves a Python object to disk using joblib."""
    path_obj = Path(filepath)
    ensure_directory(path_obj.parent)
    joblib.dump(obj, path_obj)
    logger.info(f"Saved artifact to {path_obj.resolve()}")
    return path_obj


def load_artifact(filepath: Union[str, Path]) -> Any:
    """Loads and deserializes an artifact from disk using joblib."""
    path_obj = Path(filepath)
    if not path_obj.exists():
        raise FileNotFoundError(f"Artifact not found at {path_obj.resolve()}")
    obj = joblib.load(path_obj)
    logger.info(f"Loaded artifact from {path_obj.resolve()}")
    return obj


def save_json(data: dict, filepath: Union[str, Path]) -> Path:
    """Saves a dictionary to a JSON file."""
    path_obj = Path(filepath)
    ensure_directory(path_obj.parent)
    with open(path_obj, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    logger.info(f"Saved metadata JSON to {path_obj.resolve()}")
    return path_obj


def load_json(filepath: Union[str, Path]) -> dict:
    """Loads a dictionary from a JSON file."""
    path_obj = Path(filepath)
    if not path_obj.exists():
        raise FileNotFoundError(f"JSON file not found at {path_obj.resolve()}")
    with open(path_obj, "r", encoding="utf-8") as f:
        return json.load(f)
