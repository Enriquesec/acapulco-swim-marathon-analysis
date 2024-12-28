import re

def extract_distance(category):
    if "1K" in category or "1 K" in category:
        return "1K"
    elif "5 KM" in category:
        return "5K"
    return None

def extract_age_range(category):
    """
    Extracts the age range from the category column and returns it as a string in the format 'min_age - max_age'.
    Handles irregular spacing and special cases.
    """
    # Remove extra spaces and standardize the category string
    category = re.sub(r'\s+', ' ', category.strip())
    
    # Check for ranges like "11 - 12" or "(25 - 29)"
    match = re.search(r'(\d+)\s*-\s*(\d+)', category)
    if match:
        min_age, max_age = match.groups()
        return f"{min_age} - {max_age}"

    # Handle "Y MENORES" (e.g., "8 Y MENORES")
    if "Y MENORES" in category:
        match = re.search(r'(\d+)\s*Y\s*MENORES', category)
        if match:
            max_age = match.group(1)
            return f"0 - {max_age}"

    # Handle "Y MAYORES" or "Y MAS" (e.g., "75 Y MAYORES")
    if "Y MAYORES" in category or "Y MAS" in category:
        match = re.search(r'(\d+)\s*Y\s*(MAYORES|MAS)', category)
        if match:
            min_age = match.group(1)
            return f"{min_age} +"

    # Return unspecified if age is not defined
    return "No especificado"

def extract_gender(category):
    if "FEMENIL" in category or "FEM" in category:
        return "FEMENIL"
    elif "VARONIL" in category or "VAR" in category:
        return "VARONIL"
    return None
