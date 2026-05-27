export interface TdeeInput {
  gender: string;
  age: number;
  height_cm: number;
  weight_kg: number;
  activity_level: string;
  job_type: string;
  training_days_per_week: number;
  goal: string;
}

export interface TdeeResult {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export function calculateTargets(input: TdeeInput): TdeeResult {
  const { gender, age, height_cm, weight_kg, activity_level, job_type, training_days_per_week, goal } = input;

  // Mifflin-St Jeor BMR
  let bmr: number;
  if (gender === "female") {
    bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age - 161;
  } else {
    // male and diverse use male formula
    bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age + 5;
  }

  // Base activity multiplier
  let activityMultiplier: number;
  switch (activity_level) {
    case "sedentary":
      activityMultiplier = 1.2;
      break;
    case "light":
      activityMultiplier = 1.375;
      break;
    case "moderate":
      activityMultiplier = 1.55;
      break;
    case "active":
      activityMultiplier = 1.725;
      break;
    default:
      activityMultiplier = 1.375;
  }

  // Job type adjustment (leisure activity)
  if (job_type === "moderate_active") {
    activityMultiplier += 0.1;
  } else if (job_type === "very_active") {
    activityMultiplier += 0.2;
  }

  // Training days adjustment
  if (training_days_per_week >= 4) {
    activityMultiplier += 0.1;
  } else if (training_days_per_week >= 2) {
    activityMultiplier += 0.05;
  }

  let tdee = bmr * activityMultiplier;

  // Goal adjustment
  if (goal === "lose_weight") {
    tdee -= 400;
  } else if (goal === "build_muscle") {
    tdee += 200;
  }

  const kcal = Math.round(tdee);

  // Protein: 1.8g/kg, 2.2g for build_muscle
  const proteinPerKg = goal === "build_muscle" ? 2.2 : 1.8;
  const protein_g = Math.round(weight_kg * proteinPerKg);

  // Fat: 27% of kcal / 9
  const fat_g = Math.round((kcal * 0.27) / 9);

  // Carbs: remaining calories
  const proteinKcal = protein_g * 4;
  const fatKcal = fat_g * 9;
  const carbs_g = Math.round((kcal - proteinKcal - fatKcal) / 4);

  return { kcal, protein_g, carbs_g: Math.max(0, carbs_g), fat_g };
}
