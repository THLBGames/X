#!/usr/bin/env python3
"""
Script to combine all individual item JSON files into a single items.json file.
This reduces HTTP requests from 500+ to just 1, significantly improving load performance.
"""

import json
import os
from pathlib import Path
from typing import Dict, Any

def combine_items():
    """Combine all individual item JSON files into a single items.json file."""
    
    # Get the project root (assuming script is in scripts/ directory)
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    
    # Output to both locations (source and public)
    source_items_dir = project_root / 'data' / 'items'
    public_items_dir = project_root / 'client' / 'public' / 'data' / 'items'
    
    # Use source directory for reading
    items_dir = source_items_dir
    output_file = source_items_dir / 'items.json'
    public_output_file = public_items_dir / 'items.json'
    
    if not items_dir.exists():
        print(f"Error: Items directory not found: {items_dir}")
        return False
    
    # Collect all item files (exclude manifest.json and items.json)
    item_files = []
    for item_file in items_dir.glob('*.json'):
        if item_file.name not in ['manifest.json', 'items.json']:
            item_files.append(item_file)
    
    if not item_files:
        print(f"Error: No item JSON files found in {items_dir}")
        return False
    
    print(f"Found {len(item_files)} item files to combine...")
    
    # Combine all items into a single dictionary
    combined_items: Dict[str, Any] = {}
    errors = []
    
    for item_file in sorted(item_files):
        try:
            with open(item_file, 'r', encoding='utf-8') as f:
                item_data = json.load(f)
                
            # Validate that it has an 'id' field
            if 'id' not in item_data:
                errors.append(f"{item_file.name}: Missing 'id' field")
                continue
            
            item_id = item_data['id']
            
            # Check for duplicates
            if item_id in combined_items:
                errors.append(f"{item_file.name}: Duplicate item ID '{item_id}' (already in {combined_items[item_id].get('_source_file', 'unknown')})")
                continue
            
            # Add source file metadata for debugging (optional, can be removed)
            item_data['_source_file'] = item_file.name
            
            combined_items[item_id] = item_data
            
        except json.JSONDecodeError as e:
            errors.append(f"{item_file.name}: Invalid JSON - {e}")
        except Exception as e:
            errors.append(f"{item_file.name}: Error reading file - {e}")
    
    if errors:
        print(f"\nWarning: Found {len(errors)} errors:")
        for error in errors[:10]:  # Show first 10 errors
            print(f"  - {error}")
        if len(errors) > 10:
            print(f"  ... and {len(errors) - 10} more errors")
    
    if not combined_items:
        print("Error: No valid items to combine")
        return False
    
    # Create output structure
    output_data = {
        'version': '1.0.0',
        'total_items': len(combined_items),
        'items': combined_items
    }
    
    # Write combined items to items.json (both source and public locations)
    try:
        # Remove _source_file metadata before writing (it's just for debugging)
        for item_data in combined_items.values():
            if '_source_file' in item_data:
                del item_data['_source_file']
        
        # Write to source directory
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(output_data, f, indent=2, ensure_ascii=False)
        
        file_size_kb = output_file.stat().st_size / 1024
        print(f"\nSuccessfully combined {len(combined_items)} items into {output_file}")
        print(f"   File size: {file_size_kb:.2f} KB")
        
        # Also write to public directory if it exists
        if public_items_dir.exists():
            with open(public_output_file, 'w', encoding='utf-8') as f:
                json.dump(output_data, f, indent=2, ensure_ascii=False)
            print(f"   Also copied to {public_output_file}")
        
        return True
        
    except Exception as e:
        print(f"Error writing output file: {e}")
        return False

if __name__ == '__main__':
    success = combine_items()
    exit(0 if success else 1)

