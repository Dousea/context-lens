import type { EngineInterface, RenderInput } from 'claude-code'

import { ACCENT, DASH_BG, DASH_EDGE } from '../core/palette'
import { themedEls } from '../theme'

/** The card after Save: the bar's own colours, one line, nothing moving. */
export function savedCardTree($: EngineInterface, e: RenderInput<'AbovePrompt'>) {
  const { Box, Text } = themedEls($.ui.resolve(e))
  return (
    <Box
      key="saved"
      flexDirection="row"
      alignItems="center"
      gap={1}
      paddingX={1}
      backgroundColor={DASH_BG}
      borderStyle="round"
      borderColor={DASH_EDGE}
    >
      <Text color={ACCENT}>✓</Text>
      <Text bold>Settings saved</Text>
    </Box>
  )
}
