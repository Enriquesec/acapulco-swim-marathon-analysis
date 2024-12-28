
def time_to_hours(time_str):
    """
    Converts a time string in the format 'MM:SS.ss' or 'HH:MM:SS.ss' to hours.
    """
    try:
        parts = time_str.split(':')
        if len(parts) == 2:  # Format is 'MM:SS.ss'
            minutes = int(parts[0])
            seconds = float(parts[1])
            return minutes / 60 + seconds / 3600
        elif len(parts) == 3:  # Format is 'HH:MM:SS.ss'
            hours = int(parts[0])
            minutes = int(parts[1])
            seconds = float(parts[2])
            return hours + minutes / 60 + seconds / 3600
        return None
    except:
        return None

# Create functions for converting chip time to hours and minutes
def time_to_minutes(time_str):
    """
    Converts a time string in the format 'MM:SS.ss' or 'HH:MM:SS.ss' to minutes.
    """
    try:
        parts = time_str.split(':')
        if len(parts) == 2:  # Format is 'MM:SS.ss'
            minutes = int(parts[0])
            seconds = float(parts[1])
            return minutes + seconds / 60
        elif len(parts) == 3:  # Format is 'HH:MM:SS.ss'
            hours = int(parts[0])
            minutes = int(parts[1])
            seconds = float(parts[2])
            return hours * 60 + minutes + seconds / 60
        return None
    except:
        return None