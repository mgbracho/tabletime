export type MealType = "Desayuno" | "Comida" | "Cena" | "Snacks";

export interface Household {
  id: string;
  name: string;
  created_at: string;
}

export interface HouseholdMember {
  id: string;
  household_id: string;
  user_id: string;
  role: "owner" | "member";
  created_at: string;
}

export interface Recipe {
  id: string;
  household_id: string;
  title: string;
  ingredients: string | null;
  instructions: string | null;
  tags: string[];
  created_at: string;
}

export interface PlanSlot {
  household_id: string;
  slot_key: string;
  recipe_id: string;
  created_at: string;
}

export interface GroceryItem {
  id: string;
  household_id: string;
  label: string;
  checked: boolean;
  source: "plan" | "manual";
  created_at: string;
}

export interface ThemeDay {
  household_id: string;
  day_index: number;
  meal_type: MealType;
  theme: string;
  created_at: string;
}
