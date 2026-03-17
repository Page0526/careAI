"""WHO Growth Standards Z-Score Calculator

Uses simplified LMS (Lambda-Mu-Sigma) method for pediatric z-score calculation.
Reference: WHO Child Growth Standards (0-5 years) and WHO Reference (5-19 years).

For the hackathon MVP, we use representative LMS parameters at key age points
and interpolate between them. Production systems should use the full WHO tables.
"""
import math
from typing import Optional, Tuple

# ────────────────────────────────────────────────────────────
# WHO Weight-for-Age LMS Parameters (Boys, 0-120 months)
# Source: WHO Anthro / WHO Reference simplified
# Format: age_months -> (L, M, S)
# L = Box-Cox power, M = Median, S = Coefficient of Variation
# ────────────────────────────────────────────────────────────

WFA_BOYS = {
    0: (-0.3521, 3.3464, 0.14602),
    1: (0.2709, 4.4709, 0.13395),
    3: (0.0510, 6.3762, 0.12171),
    6: (0.0155, 7.9340, 0.11727),
    9: (-0.0631, 9.0246, 0.11316),
    12: (-0.1676, 9.6548, 0.11117),
    18: (-0.2527, 10.8941, 0.10866),
    24: (-0.3833, 12.1515, 0.10590),
    36: (-0.5590, 14.3339, 0.10295),
    48: (-0.8042, 16.3489, 0.10280),
    60: (-1.0610, 18.3670, 0.10410),
    72: (-1.2712, 20.5076, 0.10610),
    84: (-1.3841, 22.9095, 0.10830),
    96: (-1.4533, 25.5942, 0.11210),
    108: (-1.4758, 28.6064, 0.11650),
    120: (-1.4409, 31.9649, 0.12180),
    132: (-1.3245, 35.7850, 0.12800),
    144: (-1.1486, 40.0600, 0.13400),
    156: (-0.9289, 44.8000, 0.13900),
    168: (-0.7090, 49.8000, 0.14200),
    180: (-0.5100, 55.0000, 0.14300),
    192: (-0.3500, 60.0000, 0.14200),
    204: (-0.2500, 64.0000, 0.14000),
    216: (-0.2000, 67.0000, 0.13500),
}

WFA_GIRLS = {
    0: (-0.3833, 3.2322, 0.14171),
    1: (0.1714, 4.1873, 0.13724),
    3: (-0.0230, 5.8458, 0.12619),
    6: (0.2331, 7.2970, 0.12179),
    9: (0.1881, 8.2849, 0.11803),
    12: (0.0390, 8.9500, 0.11540),
    18: (-0.2039, 10.1515, 0.11310),
    24: (-0.3833, 11.5180, 0.11006),
    36: (-0.5800, 13.9244, 0.10700),
    48: (-0.8200, 15.9600, 0.10900),
    60: (-1.0500, 17.9700, 0.11200),
    72: (-1.2200, 20.0800, 0.11500),
    84: (-1.3100, 22.4400, 0.11900),
    96: (-1.3500, 25.1500, 0.12400),
    108: (-1.3200, 28.2600, 0.13000),
    120: (-1.2100, 31.8700, 0.13700),
    132: (-1.0500, 36.0000, 0.14300),
    144: (-0.8500, 40.6000, 0.14800),
    156: (-0.6500, 45.4000, 0.15100),
    168: (-0.5000, 49.7000, 0.15200),
    180: (-0.4000, 53.0000, 0.15100),
    192: (-0.3500, 55.5000, 0.14800),
    204: (-0.3000, 57.0000, 0.14500),
    216: (-0.2800, 58.0000, 0.14200),
}

# ────────────────────────────────────────────────────────────
# WHO Height/Length-for-Age LMS Parameters (simplified)
# ────────────────────────────────────────────────────────────

HFA_BOYS = {
    0: (1.0, 49.8842, 0.03795),
    1: (1.0, 54.7244, 0.03557),
    3: (1.0, 61.4292, 0.03424),
    6: (1.0, 67.6236, 0.03328),
    9: (1.0, 72.3088, 0.03257),
    12: (1.0, 75.7488, 0.03210),
    18: (1.0, 82.3988, 0.03168),
    24: (1.0, 87.8161, 0.03133),
    36: (1.0, 96.0754, 0.03097),
    48: (1.0, 103.3468, 0.03072),
    60: (1.0, 110.0262, 0.03060),
    72: (1.0, 116.0642, 0.03050),
    84: (1.0, 121.7375, 0.03055),
    96: (1.0, 127.2845, 0.03063),
    108: (1.0, 132.7560, 0.03078),
    120: (1.0, 138.1700, 0.03100),
    132: (1.0, 143.5000, 0.03200),
    144: (1.0, 149.3000, 0.03350),
    156: (1.0, 155.5000, 0.03500),
    168: (1.0, 161.8000, 0.03600),
    180: (1.0, 167.3000, 0.03620),
    192: (1.0, 171.5000, 0.03580),
    204: (1.0, 174.0000, 0.03500),
    216: (1.0, 175.3000, 0.03450),
}

HFA_GIRLS = {
    0: (1.0, 49.1477, 0.03790),
    1: (1.0, 53.6872, 0.03610),
    3: (1.0, 59.8029, 0.03507),
    6: (1.0, 65.7311, 0.03440),
    9: (1.0, 70.1435, 0.03392),
    12: (1.0, 73.9015, 0.03364),
    18: (1.0, 80.7042, 0.03340),
    24: (1.0, 86.4000, 0.03310),
    36: (1.0, 95.0754, 0.03260),
    48: (1.0, 102.7468, 0.03240),
    60: (1.0, 109.4262, 0.03230),
    72: (1.0, 115.5642, 0.03240),
    84: (1.0, 121.2375, 0.03280),
    96: (1.0, 126.9845, 0.03340),
    108: (1.0, 132.7560, 0.03410),
    120: (1.0, 138.4700, 0.03490),
    132: (1.0, 144.5000, 0.03570),
    144: (1.0, 150.6000, 0.03620),
    156: (1.0, 155.5000, 0.03620),
    168: (1.0, 158.7000, 0.03590),
    180: (1.0, 160.3000, 0.03560),
    192: (1.0, 161.2000, 0.03540),
    204: (1.0, 161.6000, 0.03530),
    216: (1.0, 161.8000, 0.03520),
}


def _interpolate_lms(table: dict, age_months: float) -> Tuple[float, float, float]:
    """Interpolate LMS parameters for a given age in months."""
    ages = sorted(table.keys())

    if age_months <= ages[0]:
        return table[ages[0]]
    if age_months >= ages[-1]:
        return table[ages[-1]]

    # Find surrounding age points
    lower_age = ages[0]
    upper_age = ages[-1]
    for i in range(len(ages) - 1):
        if ages[i] <= age_months <= ages[i + 1]:
            lower_age = ages[i]
            upper_age = ages[i + 1]
            break

    # Linear interpolation
    fraction = (age_months - lower_age) / (upper_age - lower_age) if upper_age != lower_age else 0
    l_low, m_low, s_low = table[lower_age]
    l_up, m_up, s_up = table[upper_age]

    L = l_low + fraction * (l_up - l_low)
    M = m_low + fraction * (m_up - m_low)
    S = s_low + fraction * (s_up - s_low)

    return L, M, S


def calculate_zscore(value: float, age_months: float, gender: str,
                     measure_type: str = "weight") -> Optional[float]:
    """
    Calculate WHO z-score for a given measurement.

    Args:
        value: Measured value (kg for weight, cm for height)
        age_months: Age in months
        gender: 'male' or 'female'
        measure_type: 'weight' or 'height'

    Returns:
        Z-score float, or None if cannot calculate
    """
    if value <= 0 or age_months < 0:
        return None

    # Select table
    if measure_type == "weight":
        table = WFA_BOYS if gender == "male" else WFA_GIRLS
    elif measure_type == "height":
        table = HFA_BOYS if gender == "male" else HFA_GIRLS
    else:
        return None

    L, M, S = _interpolate_lms(table, age_months)

    try:
        if abs(L) < 0.001:
            # When L ≈ 0, use logarithmic formula
            z = math.log(value / M) / S
        else:
            z = (((value / M) ** L) - 1) / (L * S)

        # Clamp to reasonable range
        z = max(-10.0, min(10.0, z))
        return round(z, 2)
    except (ValueError, ZeroDivisionError):
        return None


def interpret_zscore(z: Optional[float]) -> str:
    """Interpret z-score according to WHO classification."""
    if z is None:
        return "unknown"
    if z < -3:
        return "severely_underweight"
    elif z < -2:
        return "underweight"
    elif z < -1:
        return "mildly_underweight"
    elif z <= 1:
        return "normal"
    elif z <= 2:
        return "overweight"
    elif z <= 3:
        return "obese"
    else:
        return "severely_obese"


def get_median_weight(age_months: float, gender: str) -> float:
    """Get median weight for given age and gender."""
    table = WFA_BOYS if gender == "male" else WFA_GIRLS
    _, M, _ = _interpolate_lms(table, age_months)
    return M


def get_median_height(age_months: float, gender: str) -> float:
    """Get median height for given age and gender."""
    table = HFA_BOYS if gender == "male" else HFA_GIRLS
    _, M, _ = _interpolate_lms(table, age_months)
    return M


def get_weight_range(age_months: float, gender: str,
                     sd_low: float = -3, sd_high: float = 3) -> Tuple[float, float]:
    """Get plausible weight range for given age as (min, max)."""
    table = WFA_BOYS if gender == "male" else WFA_GIRLS
    L, M, S = _interpolate_lms(table, age_months)

    def z_to_value(z):
        if abs(L) < 0.001:
            return M * math.exp(S * z)
        else:
            val = M * ((1 + L * S * z) ** (1 / L))
            return max(0.1, val)

    return z_to_value(sd_low), z_to_value(sd_high)
