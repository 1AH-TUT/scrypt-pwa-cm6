
export const TITLE_PAGE_FIELDS = [
  {
    key: 'title',
    label: 'Title',
    type: 'text',
    required: true,
    placeholder: 'Screenplay Title (required)',
    msgRequired: 'Title is required',
    maxLength: 120,
  },
  {
    key: 'byline',
    label: 'Byline',
    type: 'text',
    required: true,
    placeholder: 'e.g. Written by [Name], Draft Note, or Director Credit (required)',
    msgRequired: 'Byline is required',
    maxLength: 120,
  },
  {
    key: 'source',
    label: 'Source',
    type: 'text',
    required: false,
    placeholder: 'e.g. Original Story, or Adapted from (novel, play, true events)',
    maxLength: 160
  },
  {
    key: 'copyright',
    label: 'Copyright',
    type: 'text',
    required: false,
    placeholder: 'e.g. © Year Name or Production Company',
    maxLength: 120
  },
  {
    key: 'contact',
    label: 'Contact',
    type: 'textarea',
    required: false,
    placeholder: 'Contact details',
    maxLength: 300,
    rows: 5
  },
  {
    key: 'date',
    label: 'Date',
    type: 'date',
    required: false,
  }
];
