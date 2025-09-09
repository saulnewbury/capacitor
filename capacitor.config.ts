import { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.yourcompany.markdowneditor',
  appName: 'Markdown Editor',
  webDir: 'out', // This is the important part for Next.js
  server: {
    androidScheme: 'https',
    iosScheme: 'https'
  },
  plugins: {
    Keyboard: {
      resize: 'body',
      style: 'dark',
      resizeOnFullScreen: true
    }
  }
}

export default config
