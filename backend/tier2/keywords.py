"""Tier 2: Clinical Keyword Taxonomy

Defines keyword categories for NLP extraction from clinical notes.
Each category maps to clinical significance for nutrition assessment.
"""

# ────────────────────────────────────────────────────────────
# Keyword categories with regex-friendly patterns
# Each entry: (keyword, [aliases/variants])
# ────────────────────────────────────────────────────────────

KEYWORD_TAXONOMY = {
    "fluid_overload": {
        "display": "Fluid Overload / Edema",
        "significance": "Weight increase may reflect fluid retention, not nutritional improvement",
        "keywords": [
            "edema", "oedema", "fluid overload", "fluid retention",
            "positive fluid balance", "anasarca", "puffy", "swollen",
            "swelling", "third spacing", "periorbital edema",
            "peripheral edema", "pitting edema", "ascites",
            "pleural effusion", "pulmonary edema",
            # Vietnamese
            "phù", "phù nề", "quá tải dịch", "tràn dịch", "cổ trướng",
            "phù toàn thân", "phù ngoại biên", "phù mặt",
        ],
    },
    "dehydration": {
        "display": "Dehydration",
        "significance": "Weight decrease may be fluid loss, not nutritional decline",
        "keywords": [
            "dehydration", "dehydrated", "dry mucosa", "dry mouth",
            "poor turgor", "sunken fontanelle", "sunken eyes",
            "decreased urine output", "oliguria", "hypovolemia",
            # Vietnamese
            "mất nước", "khô miệng", "khô niêm mạc", "thóp trũng",
            "giảm turgor", "thiểu niệu",
        ],
    },
    "poor_intake": {
        "display": "Poor Oral Intake",
        "significance": "Expect weight loss or plateau if intake insufficient",
        "keywords": [
            "poor intake", "poor oral intake", "decreased intake",
            "NPO", "nil by mouth", "nil per os", "refused feeds",
            "refusing feeds", "feeding intolerance", "feed intolerance",
            "poor appetite", "anorexia", "not eating", "not tolerating",
            "inadequate intake",
            # Vietnamese
            "ăn kém", "bỏ ăn", "không ăn", "ăn ít", "nhịn ăn",
            "chán ăn", "không dung nạp", "không hấp thu",
        ],
    },
    "vomiting": {
        "display": "Vomiting / Emesis",
        "significance": "GI losses affect nutritional status and weight",
        "keywords": [
            "vomiting", "emesis", "vomit", "nausea", "nauseous",
            "projectile vomiting", "bilious vomiting", "hematemesis",
            # Vietnamese
            "nôn", "nôn ói", "buồn nôn", "nôn trớ", "ói",
        ],
    },
    "diarrhea": {
        "display": "Diarrhea / GI Loss",
        "significance": "GI losses lead to weight loss and fluid imbalance",
        "keywords": [
            "diarrhea", "diarrhoea", "loose stool", "loose stools",
            "watery stool", "high stool output", "ileostomy output",
            "stool output", "bowel loss",
            # Vietnamese
            "tiêu chảy", "đi ngoài", "phân lỏng", "phân nước",
        ],
    },
    "diuretic": {
        "display": "Diuretic Therapy",
        "significance": "Weight decrease expected from fluid removal via diuretics",
        "keywords": [
            "diuretic", "furosemide", "lasix", "bumetanide",
            "spironolactone", "hydrochlorothiazide", "HCTZ",
            "metolazone", "diuresis",
            # Vietnamese
            "lợi tiểu", "thuốc lợi tiểu",
        ],
    },
    "enteral_feeding": {
        "display": "Enteral Nutrition",
        "significance": "Active nutrition therapy – expect weight maintenance or gain",
        "keywords": [
            "enteral feeds", "enteral feeding", "tube feeding",
            "NG tube", "nasogastric", "OG tube", "orogastric",
            "PEG", "gastrostomy", "jejunostomy", "bolus feeds",
            "continuous feeds", "breast milk", "formula",
            "infant formula", "elemental formula",
            # Vietnamese
            "nuôi ống", "nuôi dưỡng qua ống", "sống NG", "ống thông dạ dày",
            "sữa mẹ", "sữa công thức",
        ],
    },
    "parenteral_nutrition": {
        "display": "Parenteral Nutrition",
        "significance": "IV nutrition – weight interpretation requires fluid balance context",
        "keywords": [
            "TPN", "total parenteral nutrition", "parenteral nutrition",
            "PN", "IV nutrition", "central line nutrition",
            "hyperalimentation", "lipid emulsion", "intralipid",
            # Vietnamese
            "nuôi dưỡng tĩnh mạch", "dinh dưỡng ngoài đường ruột",
        ],
    },
    "surgery": {
        "display": "Surgical Context",
        "significance": "Post-surgical state changes weight interpretation",
        "keywords": [
            "post-op", "postoperative", "post-operative", "surgery",
            "surgical", "procedure", "operation", "operative",
            "pre-op", "preoperative",
            # Vietnamese
            "phẫu thuật", "hậu phẫu", "tiền phẫu", "mổ",
        ],
    },
    "malnutrition": {
        "display": "Malnutrition Diagnosis",
        "significance": "Clinical malnutrition diagnosis should align with anthropometric data",
        "keywords": [
            "malnutrition", "malnourished", "undernutrition",
            "undernourished", "wasting", "stunting", "stunted",
            "failure to thrive", "FTT", "cachexia",
            "protein-energy malnutrition", "kwashiorkor", "marasmus",
            # Vietnamese
            "suy dinh dưỡng", "thiếu dinh dưỡng", "suy kiệt",
            "thấp còi", "gầy mòn", "chậm phát triển",
        ],
    },
}
