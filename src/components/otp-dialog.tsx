import * as Clipboard from 'expo-clipboard';
import { CheckIcon, CopyIcon } from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';

import { alpha, COLORS } from '@/components/kit';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';

/**
 * Shows a freshly generated login OTP in a dialog where the code can be
 * selected (long-press) or copied with one tap. Native Alert text is not
 * selectable, so this replaces it wherever an OTP is handed to the trainer.
 */
export function OtpDialog({
  otp,
  clientName,
  title = 'Client created',
  onClose,
}: {
  otp: string | null;
  clientName: string;
  title?: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    setCopied(false);
  }, [otp]);

  async function copy() {
    if (!otp) return;
    try {
      await Clipboard.setStringAsync(otp);
      setCopied(true);
    } catch {
      /* selecting the text still works */
    }
  }

  return (
    <Dialog open={otp != null} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Share this OTP with {clientName} so they can log in.</DialogDescription>
        </DialogHeader>
        <View
          style={{
            borderRadius: 14,
            borderWidth: 1,
            borderColor: alpha(COLORS.green, 0.4),
            backgroundColor: alpha(COLORS.green, 0.1),
            paddingVertical: 16,
            paddingHorizontal: 12,
            alignItems: 'center',
          }}>
          <Text selectable className="text-2xl font-bold tracking-widest">
            {otp ?? ''}
          </Text>
          <Text variant="muted" className="mt-1 text-xs">
            Long-press to select, or tap Copy.
          </Text>
        </View>
        <DialogFooter>
          <Button variant="outline" onPress={copy}>
            <Icon as={copied ? CheckIcon : CopyIcon} size={16} />
            <Text>{copied ? 'Copied' : 'Copy OTP'}</Text>
          </Button>
          <Button onPress={onClose}>
            <Text>Done</Text>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
