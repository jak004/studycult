function baseTemplate(bodyHtml: string, unsubscribeUrl: string) {
  return `
  <div style="font-family: -apple-system, Segoe UI, sans-serif; max-width: 480px; margin: 0 auto; color: #16233d;">
    <h1 style="font-size: 20px; margin-bottom: 4px;">StudyCult</h1>
    ${bodyHtml}
    <p style="margin-top: 32px; font-size: 12px; color: #5b6472;">
      Don't want these? <a href="${unsubscribeUrl}" style="color:#5b6472;">Unsubscribe from this type of email</a>.
    </p>
  </div>`
}

export function welcomeTemplate({ fullName }: { fullName: string }, unsubscribeUrl: string) {
  return {
    subject: 'Welcome to StudyCult 🎓',
    html: baseTemplate(
      `<p>Hey ${fullName || 'there'},</p>
       <p>Your StudyCult account is live. Message a tutor, join a study room, or take a quiz whenever you're ready.</p>`,
      unsubscribeUrl
    ),
  }
}

export function newMessageTemplate(
  { senderName, preview, conversationUrl }: { senderName: string; preview: string; conversationUrl: string },
  unsubscribeUrl: string
) {
  return {
    subject: `New message from ${senderName}`,
    html: baseTemplate(
      `<p><strong>${senderName}</strong> sent you a message:</p>
       <p style="padding: 12px 16px; background:#d6ece6; border-radius: 12px;">${preview}</p>
       <p><a href="${conversationUrl}" style="color:#1f8a70;">Reply on StudyCult →</a></p>`,
      unsubscribeUrl
    ),
  }
}

export function quizResultTemplate(
  { quizTitle, score, total }: { quizTitle: string; score: number; total: number },
  unsubscribeUrl: string
) {
  return {
    subject: `Your result: ${quizTitle}`,
    html: baseTemplate(
      `<p>You scored <strong>${score} / ${total}</strong> on "${quizTitle}".</p>
       <p>${score === total ? 'Perfect score! 🎉' : 'Nice work — review what you missed and try again.'}</p>`,
      unsubscribeUrl
    ),
  }
}

export function sessionBookedTemplate(
  { otherName, whenText }: { otherName: string; whenText: string },
  unsubscribeUrl: string
) {
  return {
    subject: `New session request from ${otherName}`,
    html: baseTemplate(
      `<p><strong>${otherName}</strong> requested a session for <strong>${whenText}</strong>.</p>
       <p>Confirm or decline it from your dashboard.</p>`,
      unsubscribeUrl
    ),
  }
}

export function sessionConfirmedTemplate(
  { otherName, whenText }: { otherName: string; whenText: string },
  unsubscribeUrl: string
) {
  return {
    subject: `Session confirmed with ${otherName}`,
    html: baseTemplate(
      `<p>Your session with <strong>${otherName}</strong> is confirmed for <strong>${whenText}</strong>.</p>`,
      unsubscribeUrl
    ),
  }
}

export function sessionCancelledTemplate({ otherName }: { otherName: string }, unsubscribeUrl: string) {
  return {
    subject: 'Session cancelled',
    html: baseTemplate(`<p><strong>${otherName}</strong> cancelled your upcoming session.</p>`, unsubscribeUrl),
  }
}

export function sessionReminderTemplate(
  { otherName, whenText, hoursOut }: { otherName: string; whenText: string; hoursOut: 24 | 1 },
  unsubscribeUrl: string
) {
  return {
    subject: hoursOut === 24 ? 'Session tomorrow' : 'Session starting soon',
    html: baseTemplate(
      `<p>Your session with <strong>${otherName}</strong> is <strong>${whenText}</strong> (in about ${hoursOut === 24 ? '24 hours' : 'an hour'}).</p>`,
      unsubscribeUrl
    ),
  }
}

export function weeklyDigestTemplate(
  { fullName, messageCount, quizAttemptCount }: { fullName: string; messageCount: number; quizAttemptCount: number },
  unsubscribeUrl: string
) {
  return {
    subject: 'Your week on StudyCult',
    html: baseTemplate(
      `<p>Hey ${fullName || 'there'}, here's your week:</p>
       <ul>
         <li>${messageCount} message${messageCount === 1 ? '' : 's'} received</li>
         <li>${quizAttemptCount} quiz attempt${quizAttemptCount === 1 ? '' : 's'} by your students</li>
       </ul>`,
      unsubscribeUrl
    ),
  }
}
