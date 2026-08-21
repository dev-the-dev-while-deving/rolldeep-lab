export class RollDeepError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RollDeepError";
  }
}

export class EmptyPoolError extends RollDeepError {
  constructor() {
    super("POOL EMPTY");
    this.name = "EmptyPoolError";
  }
}

export class ActiveTopicError extends RollDeepError {
  constructor() {
    super("A topic is already in progress. Complete it before rolling again.");
    this.name = "ActiveTopicError";
  }
}

export class TopicNotActiveError extends RollDeepError {
  constructor() {
    super("That topic is not the active in-progress topic.");
    this.name = "TopicNotActiveError";
  }
}

export class CannotDeleteError extends RollDeepError {
  constructor() {
    super("Only available (unrolled) topics can be deleted.");
    this.name = "CannotDeleteError";
  }
}

export class MissingKeyError extends RollDeepError {
  constructor() {
    super(
      "XAI_API_KEY is not set. Author units into content/units/*.json instead.",
    );
    this.name = "MissingKeyError";
  }
}

export class MissingProofError extends RollDeepError {
  constructor() {
    super("PROOF REQUIRED");
    this.name = "MissingProofError";
  }
}

export class SessionRollLimitError extends RollDeepError {
  constructor() {
    super("5 ROLLS THIS SESSION");
    this.name = "SessionRollLimitError";
  }
}

export class NotVisibleError extends RollDeepError {
  constructor() {
    super("That roll is not in the last 3. Pick one you can still see.");
    this.name = "NotVisibleError";
  }
}
