#!/bin/bash

# This script finds and dumps all non-binary, Git-tracked files.

outputFile="project_context_git.txt"

# 1. Verify the script is running inside a Git repository.
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "[ERROR] This is not a Git repository. Script aborted."
    exit 1
fi

# 2. If a previous dump file exists, create a timestamped backup silently.
if [[ -f "$outputFile" ]]; then
    timestamp=$(date +'%Y%m%d_%H%M%S')
    backupFile="$outputFile.$timestamp.bak"
    mv "$outputFile" "$backupFile"
fi

# 3. Create the new output file with a header.
echo "# --- Git-Tracked Files Dump | $(date) ---" > "$outputFile"

# 4. Loop through all Git-tracked files and list their status.
git ls-files | while read -r file; do
    is_text=0
    # Check if the file is a known text file type by its name or extension.
    case "$(basename -- "$file")" in
        "Dockerfile"|"CMakeLists.txt")
            is_text=1
            ;;
        *.bat|*.sh|*.c|*.h|*.hh|*.html|*.css|*.js|*.jsx|*.json|*.txt|*.md|*.yml|*.py|*.gitignore|*.gitattributes|*.gitmodules)
            is_text=1
            ;;
    esac

    # If the file is identified as text, dump it. Otherwise, skip it.
    if [[ "$is_text" -eq 1 ]]; then
        echo "[Dumping Text]  $file"
        {
            echo
            echo "======================================================================"
            echo "== FILE: $file"
            echo "======================================================================"
            echo
            cat "$file"
            echo
        } >> "$outputFile"
    else
        echo "[Skipping Binary] $file"
    fi
done