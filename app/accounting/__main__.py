# app/accounting/__main__.py
from . import estimate_consumables_cost

def main():
    cost = estimate_consumables_cost()
    print(f"Estimated consumables cost (standard envelope): £{cost:.2f}")

if __name__ == "__main__":
    main()
