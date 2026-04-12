#!/usr/bin/env python3
"""Generate realistic seed POI data for development and testing.

This creates GeoJSON files in public/pois/ with real-world places near
Link Light Rail stations. Used when the Overpass API is not reachable.

Run: python3 data/pois/generate_seed_data.py
"""

import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUTPUT_DIR = os.path.join(ROOT, "public", "pois")

# Real places near Judkins Park and other stations, with realistic metadata.
# Coordinates are approximate but placed in the correct neighborhoods.

RESTAURANTS = [
    # ── Near Judkins Park Station (lng≈-122.3045, lat≈47.5903) ──
    {"id": 1001, "name": "Catfish Corner", "category": "restaurant", "tags": ["restaurant", "seafood"], "coords": [-122.3020, 47.5895], "website": "https://catfishcorner.com"},
    {"id": 1002, "name": "Island Soul", "category": "restaurant", "tags": ["restaurant", "caribbean", "outdoor-seating"], "coords": [-122.2993, 47.5892]},
    {"id": 1003, "name": "Hanoks Korean Kitchen", "category": "restaurant", "tags": ["restaurant", "korean"], "coords": [-122.3010, 47.5880]},
    {"id": 1004, "name": "Cafe Ibex", "category": "cafe", "tags": ["cafe", "ethiopian", "vegetarian"], "coords": [-122.3035, 47.5910]},
    {"id": 1005, "name": "Pizzeria Pulcinella", "category": "restaurant", "tags": ["restaurant", "pizza", "italian", "outdoor-seating"], "coords": [-122.2990, 47.5888], "website": "https://pulcinellapizzeria.com"},
    {"id": 1006, "name": "The Neighbor Lady", "category": "bar", "tags": ["bar", "outdoor-seating"], "coords": [-122.3040, 47.5900]},
    {"id": 1007, "name": "Fat's Chicken and Waffles", "category": "restaurant", "tags": ["restaurant", "american", "child-friendly"], "coords": [-122.2985, 47.5875]},
    {"id": 1008, "name": "Hood Famous Cafe + Bar", "category": "cafe", "tags": ["cafe", "filipino", "bakery"], "coords": [-122.3055, 47.5915]},
    {"id": 1009, "name": "Taco Street", "category": "fast_food", "tags": ["fast_food", "mexican", "tacos"], "coords": [-122.3000, 47.5870]},
    {"id": 1010, "name": "Kirin Bubble Tea", "category": "cafe", "tags": ["cafe", "bubble-tea", "asian"], "coords": [-122.3025, 47.5905]},
    {"id": 1011, "name": "Empire Espresso", "category": "cafe", "tags": ["cafe", "coffee", "outdoor-seating"], "coords": [-122.2975, 47.5860]},
    {"id": 1012, "name": "Bar Vivant", "category": "bar", "tags": ["bar", "spanish", "tapas", "outdoor-seating"], "coords": [-122.2988, 47.5882]},
    {"id": 1013, "name": "Biscuit Bitch", "category": "restaurant", "tags": ["restaurant", "american", "breakfast"], "coords": [-122.3060, 47.5920]},
    {"id": 1014, "name": "Musang", "category": "restaurant", "tags": ["restaurant", "filipino", "outdoor-seating"], "coords": [-122.2980, 47.5865]},
    {"id": 1015, "name": "Rachel's Ginger Beer", "category": "bar", "tags": ["bar", "ginger-beer"], "coords": [-122.3015, 47.5898]},
    {"id": 1016, "name": "Umami Kushi", "category": "restaurant", "tags": ["restaurant", "japanese", "sushi"], "coords": [-122.3005, 47.5885]},
    {"id": 1017, "name": "Columbia City Bakery", "category": "bakery", "tags": ["bakery", "outdoor-seating"], "coords": [-122.2970, 47.5855]},
    {"id": 1018, "name": "Super Six", "category": "restaurant", "tags": ["restaurant", "southeast-asian", "outdoor-seating", "child-friendly"], "coords": [-122.2965, 47.5858]},
    {"id": 1019, "name": "La Medusa", "category": "restaurant", "tags": ["restaurant", "italian", "mediterranean"], "coords": [-122.2960, 47.5850]},
    {"id": 1020, "name": "Viet Wok", "category": "fast_food", "tags": ["fast_food", "vietnamese", "pho"], "coords": [-122.3030, 47.5908]},
    # ── Near Westlake Station (lng≈-122.337, lat≈47.612) ──
    {"id": 2001, "name": "Pike Place Chowder", "category": "restaurant", "tags": ["restaurant", "seafood", "chowder"], "coords": [-122.3425, 47.6097]},
    {"id": 2002, "name": "Starbucks Reserve Roastery", "category": "cafe", "tags": ["cafe", "coffee"], "coords": [-122.3285, 47.6143], "website": "https://starbucksreserve.com"},
    {"id": 2003, "name": "Japonessa", "category": "restaurant", "tags": ["restaurant", "japanese", "sushi", "outdoor-seating"], "coords": [-122.3390, 47.6110]},
    {"id": 2004, "name": "Thai Tom", "category": "restaurant", "tags": ["restaurant", "thai"], "coords": [-122.3152, 47.6600]},
    {"id": 2005, "name": "Din Tai Fung", "category": "restaurant", "tags": ["restaurant", "chinese", "dumplings", "child-friendly"], "coords": [-122.3380, 47.6125], "website": "https://dintaifungusa.com"},
    {"id": 2006, "name": "Serious Pie", "category": "restaurant", "tags": ["restaurant", "pizza", "italian", "outdoor-seating"], "coords": [-122.3400, 47.6135]},
    {"id": 2007, "name": "Lola", "category": "restaurant", "tags": ["restaurant", "mediterranean", "greek"], "coords": [-122.3395, 47.6130]},
    {"id": 2008, "name": "Tat's Deli", "category": "fast_food", "tags": ["fast_food", "deli", "sandwich"], "coords": [-122.3330, 47.6005]},
    {"id": 2009, "name": "Storyville Coffee", "category": "cafe", "tags": ["cafe", "coffee", "outdoor-seating"], "coords": [-122.3410, 47.6090]},
    {"id": 2010, "name": "Purple Cafe and Wine Bar", "category": "bar", "tags": ["bar", "wine", "outdoor-seating"], "coords": [-122.3365, 47.6120]},
    # ── Near Capitol Hill Station (lng≈-122.320, lat≈47.619) ──
    {"id": 3001, "name": "Momiji", "category": "restaurant", "tags": ["restaurant", "japanese", "sushi"], "coords": [-122.3195, 47.6180]},
    {"id": 3002, "name": "Vivace Espresso", "category": "cafe", "tags": ["cafe", "coffee", "outdoor-seating"], "coords": [-122.3210, 47.6200]},
    {"id": 3003, "name": "Oddfellows Cafe", "category": "cafe", "tags": ["cafe", "brunch", "outdoor-seating", "child-friendly"], "coords": [-122.3188, 47.6185]},
    {"id": 3004, "name": "Tacos Chukis", "category": "fast_food", "tags": ["fast_food", "mexican", "tacos"], "coords": [-122.3220, 47.6195]},
    {"id": 3005, "name": "Canon", "category": "bar", "tags": ["bar", "cocktails", "whiskey"], "coords": [-122.3175, 47.6170]},
    # ── Near Pioneer Square Station (lng≈-122.331, lat≈47.603) ──
    {"id": 4001, "name": "Salumi", "category": "restaurant", "tags": ["restaurant", "italian", "deli", "sandwich"], "coords": [-122.3325, 47.6010]},
    {"id": 4002, "name": "Grand Central Bakery", "category": "bakery", "tags": ["bakery", "outdoor-seating"], "coords": [-122.3310, 47.6020]},
    {"id": 4003, "name": "Damn the Weather", "category": "bar", "tags": ["bar", "cocktails", "outdoor-seating"], "coords": [-122.3320, 47.6015]},
    # ── Near University District Station (lng≈-122.314, lat≈47.660) ──
    {"id": 5001, "name": "Schultzy's Sausages", "category": "restaurant", "tags": ["restaurant", "german", "sausage", "outdoor-seating"], "coords": [-122.3140, 47.6595]},
    {"id": 5002, "name": "Cafe Allegro", "category": "cafe", "tags": ["cafe", "coffee"], "coords": [-122.3155, 47.6610]},
    {"id": 5003, "name": "U:Don", "category": "restaurant", "tags": ["restaurant", "japanese", "udon", "noodles"], "coords": [-122.3148, 47.6605]},
    # ── Near Bellevue Downtown Station (lng≈-122.192, lat≈47.615) ──
    {"id": 6001, "name": "Wild Ginger", "category": "restaurant", "tags": ["restaurant", "asian", "outdoor-seating"], "coords": [-122.1930, 47.6155]},
    {"id": 6002, "name": "Fogo de Chao", "category": "restaurant", "tags": ["restaurant", "brazilian", "steakhouse", "child-friendly"], "coords": [-122.1925, 47.6148]},
    {"id": 6003, "name": "Seastar Restaurant", "category": "restaurant", "tags": ["restaurant", "seafood", "sushi"], "coords": [-122.1910, 47.6160]},
    {"id": 6004, "name": "Top Pot Doughnuts", "category": "cafe", "tags": ["cafe", "bakery", "doughnuts", "child-friendly"], "coords": [-122.1935, 47.6145]},
    # ── Near Columbia City Station (lng≈-122.293, lat≈47.560) ──
    {"id": 7001, "name": "Tutta Bella", "category": "restaurant", "tags": ["restaurant", "pizza", "italian", "child-friendly", "outdoor-seating"], "coords": [-122.2930, 47.5600]},
    {"id": 7002, "name": "Full Tilt Ice Cream", "category": "ice_cream", "tags": ["ice_cream", "child-friendly"], "coords": [-122.2925, 47.5595]},
    {"id": 7003, "name": "La Teranga", "category": "restaurant", "tags": ["restaurant", "african", "senegalese"], "coords": [-122.2935, 47.5605]},
    # ── Near Beacon Hill Station (lng≈-122.312, lat≈47.579) ──
    {"id": 8001, "name": "Perihelion Brewery", "category": "pub", "tags": ["pub", "brewery", "outdoor-seating"], "coords": [-122.3130, 47.5795]},
    {"id": 8002, "name": "Oak", "category": "restaurant", "tags": ["restaurant", "korean", "fried-chicken"], "coords": [-122.3115, 47.5788]},
    # ── Near International District Station (lng≈-122.328, lat≈47.598) ──
    {"id": 9001, "name": "Tai Tung", "category": "restaurant", "tags": ["restaurant", "chinese"], "coords": [-122.3260, 47.5985]},
    {"id": 9002, "name": "Dough Zone", "category": "restaurant", "tags": ["restaurant", "chinese", "dumplings", "child-friendly"], "coords": [-122.3275, 47.5990]},
    {"id": 9003, "name": "Kau Kau BBQ", "category": "restaurant", "tags": ["restaurant", "chinese", "bbq"], "coords": [-122.3268, 47.5982]},
    {"id": 9004, "name": "Uwajimaya", "category": "restaurant", "tags": ["restaurant", "asian", "grocery"], "coords": [-122.3272, 47.5978]},
    {"id": 9005, "name": "Oasis Tea Zone", "category": "cafe", "tags": ["cafe", "bubble-tea", "asian"], "coords": [-122.3265, 47.5988]},
    # ── Near Northgate Station ──
    {"id": 10001, "name": "Katsu Burger", "category": "fast_food", "tags": ["fast_food", "japanese", "burger"], "coords": [-122.3280, 47.7035]},
    # ── Near Roosevelt Station ──
    {"id": 10002, "name": "Bongos", "category": "restaurant", "tags": ["restaurant", "cuban", "latin"], "coords": [-122.3165, 47.6770]},
    # ── Near Mount Baker Station ──
    {"id": 10003, "name": "Cafe Flora", "category": "restaurant", "tags": ["restaurant", "vegetarian", "vegan", "outdoor-seating"], "coords": [-122.2980, 47.5770]},
]

ATTRACTIONS = [
    # ── Near Judkins Park ──
    {"id": 20001, "name": "Northwest African American Museum", "category": "museum", "tags": ["museum"], "coords": [-122.3048, 47.5910], "website": "https://naamnw.org"},
    {"id": 20002, "name": "Pratt Fine Arts Center", "category": "gallery", "tags": ["gallery", "art"], "coords": [-122.3030, 47.5900]},
    {"id": 20003, "name": "Columbia City Gallery", "category": "gallery", "tags": ["gallery", "art"], "coords": [-122.2935, 47.5605]},
    # ── Near Westlake / Pioneer Square ──
    {"id": 20004, "name": "Seattle Art Museum", "category": "museum", "tags": ["museum", "art"], "coords": [-122.3380, 47.6073], "website": "https://seattleartmuseum.org"},
    {"id": 20005, "name": "Seattle Great Wheel", "category": "attraction", "tags": ["attraction", "viewpoint"], "coords": [-122.3425, 47.6062]},
    {"id": 20006, "name": "Pike Place Market", "category": "attraction", "tags": ["attraction"], "coords": [-122.3425, 47.6090]},
    {"id": 20007, "name": "Smith Tower", "category": "viewpoint", "tags": ["viewpoint", "attraction"], "coords": [-122.3315, 47.6020]},
    {"id": 20008, "name": "Klondike Gold Rush Museum", "category": "museum", "tags": ["museum"], "coords": [-122.3320, 47.6000]},
    {"id": 20009, "name": "Underground Tour", "category": "attraction", "tags": ["attraction"], "coords": [-122.3325, 47.6018]},
    # ── Near Capitol Hill ──
    {"id": 20010, "name": "Jimi Hendrix Statue", "category": "artwork", "tags": ["artwork"], "coords": [-122.3205, 47.6200]},
    # ── Near UW Station ──
    {"id": 20011, "name": "Henry Art Gallery", "category": "museum", "tags": ["museum", "art"], "coords": [-122.3115, 47.6565]},
    {"id": 20012, "name": "Burke Museum", "category": "museum", "tags": ["museum"], "coords": [-122.3140, 47.6610], "website": "https://burkemuseum.org"},
    # ── Near Bellevue ──
    {"id": 20013, "name": "Bellevue Arts Museum", "category": "museum", "tags": ["museum", "art"], "coords": [-122.1935, 47.6155], "website": "https://bellevuearts.org"},
    # ── Near International District ──
    {"id": 20014, "name": "Wing Luke Museum", "category": "museum", "tags": ["museum"], "coords": [-122.3255, 47.5985], "website": "https://wingluke.org"},
]

PARKS = [
    # ── Near Judkins Park ──
    {"id": 30001, "name": "Judkins Park", "category": "park", "tags": ["park", "child-friendly"], "coords": [-122.3048, 47.5905]},
    {"id": 30002, "name": "Jimi Hendrix Park", "category": "park", "tags": ["park"], "coords": [-122.3030, 47.5885]},
    {"id": 30003, "name": "Sam Smith Park", "category": "park", "tags": ["park", "playground", "child-friendly"], "coords": [-122.3065, 47.5925]},
    {"id": 30004, "name": "Judkins Park Playground", "category": "playground", "tags": ["playground", "child-friendly"], "coords": [-122.3050, 47.5902]},
    {"id": 30005, "name": "I-90 Lid Community Garden", "category": "garden", "tags": ["garden"], "coords": [-122.3020, 47.5895]},
    # ── Near Westlake ──
    {"id": 30006, "name": "Westlake Park", "category": "park", "tags": ["park"], "coords": [-122.3370, 47.6115]},
    {"id": 30007, "name": "Freeway Park", "category": "park", "tags": ["park", "garden"], "coords": [-122.3340, 47.6095]},
    # ── Near Capitol Hill ──
    {"id": 30008, "name": "Cal Anderson Park", "category": "park", "tags": ["park", "playground", "child-friendly"], "coords": [-122.3195, 47.6175]},
    {"id": 30009, "name": "Volunteer Park", "category": "park", "tags": ["park", "garden", "viewpoint"], "coords": [-122.3155, 47.6310]},
    # ── Near UW ──
    {"id": 30010, "name": "UW Botanic Gardens", "category": "garden", "tags": ["garden"], "coords": [-122.2955, 47.6565]},
    {"id": 30011, "name": "Rainier Vista", "category": "park", "tags": ["park", "viewpoint"], "coords": [-122.3095, 47.6535]},
    # ── Near Columbia City ──
    {"id": 30012, "name": "Genesee Park", "category": "park", "tags": ["park", "playground", "child-friendly"], "coords": [-122.2870, 47.5630]},
    {"id": 30013, "name": "Rainier Playfield", "category": "playground", "tags": ["playground", "child-friendly"], "coords": [-122.2935, 47.5585]},
    # ── Near Beacon Hill ──
    {"id": 30014, "name": "Jefferson Park", "category": "park", "tags": ["park", "playground", "viewpoint", "child-friendly"], "coords": [-122.3110, 47.5720]},
    # ── Near Pioneer Square ──
    {"id": 30015, "name": "Occidental Square", "category": "park", "tags": ["park"], "coords": [-122.3325, 47.6005]},
    # ── Near International District ──
    {"id": 30016, "name": "Hing Hay Park", "category": "park", "tags": ["park"], "coords": [-122.3260, 47.5983]},
    # ── Near Bellevue ──
    {"id": 30017, "name": "Bellevue Downtown Park", "category": "park", "tags": ["park", "garden", "child-friendly"], "coords": [-122.1950, 47.6120]},
    # ── Near Mount Baker ──
    {"id": 30018, "name": "Mount Baker Park", "category": "park", "tags": ["park", "playground", "child-friendly"], "coords": [-122.2880, 47.5780]},
    # ── Near Othello ──
    {"id": 30019, "name": "Othello Park", "category": "park", "tags": ["park", "playground", "child-friendly"], "coords": [-122.2810, 47.5375]},
    # ── Near Rainier Beach ──
    {"id": 30020, "name": "Kubota Garden", "category": "garden", "tags": ["garden"], "coords": [-122.2690, 47.5170]},
]


def to_feature(item):
    props = {
        "id": item["id"],
        "name": item["name"],
        "category": item["category"],
        "tags": item["tags"],
    }
    if item.get("website"):
        props["website"] = item["website"]
    return {
        "type": "Feature",
        "properties": props,
        "geometry": {"type": "Point", "coordinates": item["coords"]},
    }


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    datasets = {
        "restaurants": RESTAURANTS,
        "attractions": ATTRACTIONS,
        "parks": PARKS,
    }

    for name, items in datasets.items():
        fc = {
            "type": "FeatureCollection",
            "features": [to_feature(item) for item in items],
        }
        path = os.path.join(OUTPUT_DIR, f"{name}.geojson")
        with open(path, "w") as f:
            json.dump(fc, f)
        print(f"  {name}: {len(fc['features'])} features → {path}")

    print("\nDone. Seed data written to public/pois/")


if __name__ == "__main__":
    main()
