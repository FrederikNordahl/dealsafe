import { Redirect } from 'expo-router';

export default function NotFoundScreen() {
  // Silently redirect to home - this handles share intent deep links
  return <Redirect href="/" />;
}

