#!/usr/bin/env python3
"""
Generic script to combine individual JSON files into combined JSON files.
This reduces HTTP requests significantly, improving load performance.

Supports all data types: classes, monsters, skills, dungeons, quests, 
mercenaries, upgrades, achievements.
"""

import json
from pathlib import Path
from typing import Dict, Any, List, Optional


def combine_data_type(data_type: str, is_array_format: bool = False) -> bool:
    """
    Combine all individual JSON files for a data type into a single combined file.
    
    Args:
        data_type: The data type name (e.g., 'classes', 'monsters', 'skills')
        is_array_format: If True, input files are arrays. If False, each file is a single object.
    
    Returns:
        True if successful, False otherwise
    """
    # Get the project root (assuming script is in scripts/ directory)
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    
    # Paths for source and public directories
    source_dir = project_root / 'data' / data_type
    public_dir = project_root / 'client' / 'public' / 'data' / data_type
    
    output_filename = f"{data_type}.json"
    output_file = source_dir / output_filename
    public_output_file = public_dir / output_filename
    
    if not source_dir.exists():
        print(f"Error: {data_type} directory not found: {source_dir}")
        return False
    
    # Collect all JSON files (exclude the combined file and manifest.json)
    data_files = []
    exclude_files = {output_filename, 'manifest.json'}
    
    for json_file in source_dir.glob('*.json'):
        if json_file.name not in exclude_files:
            data_files.append(json_file)
    
    if not data_files:
        print(f"Error: No {data_type} JSON files found in {source_dir}")
        return False
    
    print(f"\nCombining {len(data_files)} {data_type} files...")
    
    # Combine all data into a single dictionary
    combined_data: Dict[str, Any] = {}
    errors = []
    
    for data_file in sorted(data_files):
        try:
            with open(data_file, 'r', encoding='utf-8') as f:
                file_data = json.load(f)
            
            # Handle array format (achievements) or single object format (most types)
            items = []
            if is_array_format:
                # File contains an array of objects
                if isinstance(file_data, list):
                    items = file_data
                else:
                    # Sometimes it might be a single object in array format files
                    items = [file_data]
            else:
                # File contains a single object
                if isinstance(file_data, list):
                    # Sometimes single object files might be arrays with one item
                    items = file_data
                else:
                    items = [file_data]
            
            # Process each item
            for item_data in items:
                # Validate that it has an 'id' field
                if not isinstance(item_data, dict) or 'id' not in item_data:
                    errors.append(f"{data_file.name}: Missing 'id' field or invalid structure")
                    continue
                
                item_id = item_data['id']
                
                # Check for duplicates
                if item_id in combined_data:
                    errors.append(
                        f"{data_file.name}: Duplicate {data_type[:-1]} ID '{item_id}' "
                        f"(already loaded from another file)"
                    )
                    continue
                
                combined_data[item_id] = item_data
                
        except json.JSONDecodeError as e:
            errors.append(f"{data_file.name}: Invalid JSON - {e}")
        except Exception as e:
            errors.append(f"{data_file.name}: Error reading file - {e}")
    
    if errors:
        print(f"\nWarning: Found {len(errors)} errors:")
        for error in errors[:10]:  # Show first 10 errors
            print(f"  - {error}")
        if len(errors) > 10:
            print(f"  ... and {len(errors) - 10} more errors")
    
    if not combined_data:
        print(f"Error: No valid {data_type} to combine")
        return False
    
    # Create output structure (matching items.json pattern)
    # Use singular form for the key (classes -> classes, monsters -> monsters, etc.)
    output_key = data_type  # e.g., 'classes', 'monsters', etc.
    total_key = f"total_{data_type}"  # e.g., 'total_classes', 'total_monsters'
    
    output_data = {
        'version': '1.0.0',
        total_key: len(combined_data),
        output_key: combined_data
    }
    
    # Write combined data to JSON file (both source and public locations)
    try:
        # Write to source directory
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(output_data, f, indent=2, ensure_ascii=False)
        
        file_size_kb = output_file.stat().st_size / 1024
        print(f"Successfully combined {len(combined_data)} {data_type} into {output_file}")
        print(f"   File size: {file_size_kb:.2f} KB")
        
        # Also write to public directory if it exists
        if public_dir.exists():
            public_dir.mkdir(parents=True, exist_ok=True)
            with open(public_output_file, 'w', encoding='utf-8') as f:
                json.dump(output_data, f, indent=2, ensure_ascii=False)
            print(f"   Also copied to {public_output_file}")
        
        return True
        
    except Exception as e:
        print(f"Error writing output file: {e}")
        return False


def combine_all():
    """Combine all data types."""
    data_types = [
        ('classes', False),
        ('monsters', False),
        ('skills', False),
        ('dungeons', False),
        ('quests', False),
        ('mercenaries', False),
        ('upgrades', False),
        ('achievements', True),  # Achievements are stored as arrays
        ('items', False),  # Keep items for compatibility
    ]
    
    success_count = 0
    total_count = len(data_types)
    
    for data_type, is_array_format in data_types:
        if combine_data_type(data_type, is_array_format):
            success_count += 1
    
    print(f"\n{'='*60}")
    print(f"Combined {success_count}/{total_count} data types successfully")
    print(f"{'='*60}")
    
    return success_count == total_count


if __name__ == '__main__':
    import sys
    
    # If a data type is provided as argument, combine only that type
    if len(sys.argv) > 1:
        data_type = sys.argv[1]
        # Check if it's an array format type
        is_array_format = data_type == 'achievements'
        success = combine_data_type(data_type, is_array_format)
        exit(0 if success else 1)
    else:
        # Combine all data types
        success = combine_all()
        exit(0 if success else 1)

