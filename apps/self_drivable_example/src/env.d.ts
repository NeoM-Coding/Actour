declare const process: {
  env: {
    EXPO_PUBLIC_OPENAI_API_KEY?: string;
    EXPO_PUBLIC_OPENAI_MODEL?: string;
    EXPO_PUBLIC_OPENAI_BASE_URL?: string;
    EXPO_PUBLIC_DEEPSEEK_API_KEY?: string;
    EXPO_PUBLIC_DEEPSEEK_MODEL?: string;
    EXPO_PUBLIC_DEEPSEEK_BASE_URL?: string;
    EXPO_PUBLIC_ACTOUR_MODEL_PROVIDER?: "openai" | "deepseek";
    EXPO_PUBLIC_ACTOUR_DEBUG?: string;
  };
};
