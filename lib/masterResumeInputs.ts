// Raw updates stay in component memory and the consolidation request only.
export const MAX_MASTER_INPUTS = 10
export const MAX_INPUT_CHARACTERS = 30000
export const TYPED_UPDATE_PREFIX = "CANDIDATE'S NEWEST TYPED UPDATE (supplemental career information):\n"
export const MAX_UPDATE_CHARACTERS = MAX_INPUT_CHARACTERS - TYPED_UPDATE_PREFIX.length

export function consolidationInputs(files: { name: string; text: string }[], notes: string): { inputs: string[]; error: string } {
  const update = notes.trim()
  const inputs = [...files.map(file => file.text), ...(update ? [TYPED_UPDATE_PREFIX + update] : [])]
  if (!files.length) return { inputs, error: 'Upload at least one resume to build your master resume.' }
  if (inputs.length < 2) return { inputs, error: 'Add what’s new below or upload another resume to continue.' }
  if (inputs.length > MAX_MASTER_INPUTS) return { inputs, error: 'Use at most 10 inputs in total. Your typed update counts as one input; remove a file or clear the update.' }
  if (inputs.some(text => text.length > MAX_INPUT_CHARACTERS)) return { inputs, error: 'Each resume or typed update must fit within 30,000 characters. Shorten the update or use a shorter resume.' }
  if (files.some(file => !file.text.trim())) return { inputs, error: 'A resume has no readable text. Remove it and upload a different file.' }
  return { inputs, error: '' }
}
