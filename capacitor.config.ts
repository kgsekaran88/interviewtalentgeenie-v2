import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.interviewtalentgeenie.app',
  appName: 'talentgeenie',
  webDir: 'dist',
  server: {
    // Set your production URL here when deploying
    // url: 'https://app.interviewtalentgeenie.com',
    cleartext: true
  }
};

export default config;