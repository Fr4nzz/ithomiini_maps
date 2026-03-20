"""
Country name standardization utility.

Converts ISO 3166-1 alpha-2 codes to common English names using pycountry,
and normalizes variant spellings (hyphens, ampersands).

Used by: process_data.py, gbif_download_api.py, curation/output.py,
         statistics/generate_statistics.py
"""

import pycountry

# Cache lookups to avoid repeated pycountry calls
_cache = {}


def standardize_country(name):
    """Convert ISO 2-letter codes to full names and normalize variant spellings."""
    if not name or name in ('Unknown', 'nan', ''):
        return name
    if name in _cache:
        return _cache[name]

    result = name
    # Try as ISO 2-letter code
    if len(name) == 2 and name.isupper():
        country = pycountry.countries.get(alpha_2=name)
        if country:
            result = getattr(country, 'common_name', country.name)
    else:
        # Normalize variant spellings (hyphens, ampersands)
        normalized = name.replace('-', ' ').replace('&', 'and')
        if normalized != name:
            result = normalized

    _cache[name] = result
    return result
