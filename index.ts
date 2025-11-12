// index.ts  (root entry) — this MUST be the first import in the app
import 'react-native-gesture-handler';

import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);
