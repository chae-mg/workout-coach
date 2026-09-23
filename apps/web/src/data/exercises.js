// The GAS build injects embedded assets. Native browser modules use local files.
const assets = typeof __WORKOUT_ASSETS__ === 'undefined'
  ? { icon: './public/icon.svg', exercise: './public/exercise.svg' }
  : __WORKOUT_ASSETS__;
export const DEFAULT_EXERCISE_IMAGE = assets.exercise;
export const APP_CONFIG = {
  name: 'Workout Coach',
  themeColor: '#101b20',
  iconUrl: assets.icon,
  appleTouchIconUrl: ''
};

const make = (id, name, nameEn, target, category, type, min, max, restSeconds, phases) => ({
  id, name, nameEn, target, category, type,
  imageUrl: DEFAULT_EXERCISE_IMAGE,
  sets: 3,
  reps: { min, max },
  durationSeconds: null,
  restSeconds,
  tempo: { enabled: phases.length > 0, phases }
});

export const EXERCISES = [
  make('squat', '스쿼트', 'Squat', '하체', 'lower', 'REPS', 15, 20, 90, [3, 1, 2]),
  make('push_up', '팔굽혀펴기', 'Push-up', '가슴 · 삼두', 'upper', 'REPS', 8, 15, 90, [2, 1, 1]),
  make('one_arm_row', '원암 덤벨 로우', 'One-arm Dumbbell Row', '등 · 광배근 · 이두', 'upper', 'BOTH_SIDE_REPS', 8, 12, 90, [2, 1, 2]),
  make('hammer_curl', '해머 컬', 'Hammer Curl', '이두 · 전완', 'upper', 'REPS', 8, 12, 60, [2, 1, 2]),
  make('overhead_triceps_extension', '오버헤드 트라이셉스 익스텐션', 'Overhead Triceps Extension', '삼두', 'upper', 'REPS', 8, 12, 60, [2, 1, 2]),
  make('crunch', '크런치', 'Crunch', '복부', 'core', 'REPS', 15, 20, 60, [2, 1, 2]),
  make('reverse_crunch', '리버스 크런치', 'Reverse Crunch', '하복부 · 골반 컨트롤', 'core', 'REPS', 8, 15, 60, [2, 1, 2]),
  make('dead_bug', '데드 버그', 'Dead Bug', '코어 · 골반 안정', 'core', 'BOTH_SIDE_REPS', 6, 10, 60, []),
  {
    id: 'plank', name: '플랭크', nameEn: 'Plank', target: '코어', category: 'core',
    type: 'TIME', imageUrl: DEFAULT_EXERCISE_IMAGE, sets: 3, reps: null,
    durationSeconds: 30, restSeconds: 60, tempo: { enabled: false, phases: [] }
  },
  {
    id: 'warm_up', name: '준비 운동', nameEn: 'Warm-up', target: '전신', category: 'full',
    type: 'TIME_BLOCK', imageUrl: DEFAULT_EXERCISE_IMAGE, sets: 1, reps: null,
    durationSeconds: 120, restSeconds: 0, tempo: { enabled: false, phases: [] }
  }
];
