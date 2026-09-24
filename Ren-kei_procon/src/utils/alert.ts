import { Alert as RNAlert, Platform } from 'react-native';

type AlertButton = {
  text?: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
};

/**
 * react-native-webのAlert.alert()は空実装(何も表示しない)なため、Web版では
 * ポップアップが一切出ない。window.alert/window.confirmで代替する。
 * ネイティブでは通常通りReact NativeのAlert.alertを使う。
 */
function alert(title: string, message?: string, buttons?: AlertButton[]): void {
  if (Platform.OS !== 'web') {
    RNAlert.alert(title, message, buttons);
    return;
  }
  const text = message ? `${title}\n\n${message}` : title;
  if (buttons && buttons.length > 1) {
    const confirmed = window.confirm(text);
    const chosen = confirmed
      ? buttons.find((b) => b.style !== 'cancel') ?? buttons[buttons.length - 1]
      : buttons.find((b) => b.style === 'cancel');
    chosen?.onPress?.();
    return;
  }
  window.alert(text);
  buttons?.[0]?.onPress?.();
}

export const Alert = { alert };
