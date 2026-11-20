import { cn } from '@/lib/utils';
import { Platform, TextInput } from 'react-native';

/** Rounded, high-contrast field. Placeholder and cursor colours are explicit
 *  because className placeholder styles are dropped on native. */
function Input({
  className,
  placeholderTextColor,
  ...props
}: React.ComponentProps<typeof TextInput> & React.RefAttributes<TextInput>) {
  return (
    <TextInput
      className={cn(
        'border-input bg-background text-foreground flex h-12 w-full min-w-0 flex-row items-center rounded-2xl border px-4 py-0 text-base',
        props.editable === false &&
          cn(
            'opacity-50',
            Platform.select({ web: 'disabled:pointer-events-none disabled:cursor-not-allowed' })
          ),
        Platform.select({
          web: cn(
            'placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground outline-none transition-[color,box-shadow] md:text-sm',
            'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
            'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive'
          ),
        }),
        className
      )}
      textAlignVertical={props.multiline ? 'top' : 'center'}
      placeholderTextColor={placeholderTextColor ?? '#64748B'}
      selectionColor="#3ADD6C"
      cursorColor="#3ADD6C"
      {...props}
    />
  );
}

export { Input };
