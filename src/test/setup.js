import '@testing-library/jest-dom/vitest'

// jsdom doesn't implement scrollIntoView at all — ChatWindow calls it on
// every message list update, which would otherwise throw in every test that
// renders it.
Element.prototype.scrollIntoView = () => {}
