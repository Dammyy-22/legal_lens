const DRAFT_SUBJECTS = {
  information_request: 'REQUEST FOR INFORMATION / RECORDS',
  repair_request: 'REQUEST FOR INSPECTION / REPAIR',
  consumer_complaint: 'COMPLAINT AND REQUEST FOR RESPONSE',
  workplace_records: 'REQUEST FOR EMPLOYMENT RECORDS / CLARIFICATION',
  meeting_follow_up: 'MEETING FOLLOW-UP AND CONFIRMATION',
}

export function buildTemplateFallback(draftType, recipient, facts) {
  const subject = DRAFT_SUBJECTS[draftType]
  if (!subject) throw new Error('Unsupported correspondence type')

  const recipientName = recipient.trim() || '[Recipient name / designation]'
  const particulars = {
    information_request: '[Identify the information or records requested]',
    repair_request: '[State the specific inspection or repair requested]',
    consumer_complaint: '[State the resolution or response requested]',
    workplace_records: '[Identify the records or clarification requested]',
    meeting_follow_up: '[List the points you want the recipient to confirm]',
  }[draftType]

  return [
    "[Sender's full name]",
    "[Sender's address]",
    '[Telephone / email]',
    '[Date]',
    '',
    recipientName,
    "[Recipient's address]",
    '',
    `Dear ${recipient.trim() ? recipientName : 'Sir/Madam'},`,
    '',
    `RE: ${subject}`,
    '',
    `1. I write in relation to the matter stated above.`,
    '',
    `2. The relevant facts, as provided, are as follows: ${facts.trim()}`,
    '',
    `3. I respectfully request that you: ${particulars}.`,
    '',
    '4. Kindly acknowledge receipt and provide your response. If a response date is important, please insert it here: [requested response date].',
    '',
    'Yours faithfully,',
    '',
    "[Sender's full name]",
  ].join('\n')
}

export function isFormalCorrespondence(draft) {
  return /^RE:\s.+$/mi.test(draft)
    && [1, 2, 3].every((number) => new RegExp(`^\\s*${number}\\.\\s+`, 'm').test(draft))
    && /^\s*Yours\s+(?:faithfully|sincerely)\b/im.test(draft)
}
