/**
 * Unit tests for Adaptive Card templates
 */
import {
  createSummaryCard,
  createProcessingCard,
  createErrorCard,
  createMeetingListCard,
  createWelcomeCard,
  createHelpCard,
} from '../../src/cards/summaryCard';
import { ExtendedWorkItemResult } from '../../src/services/devopsService';

describe('Adaptive Card Templates', () => {
  describe('createSummaryCard', () => {
    const sampleWorkItems: ExtendedWorkItemResult[] = [
      {
        id: 123,
        url: 'https://dev.azure.com/org/project/_workitems/edit/123',
        title: 'Fix login bug',
        type: 'Bug',
        correlationId: 'test-correlation-123',
        assigneeResolution: {
          originalName: 'John Smith',
          resolved: true,
          user: {
            id: 'user-123',
            displayName: 'John Smith',
            userPrincipalName: 'john@example.com',
            mail: 'john@example.com',
            confidence: 'high',
          },
        },
      },
      {
        id: 124,
        url: 'https://dev.azure.com/org/project/_workitems/edit/124',
        title: 'Update documentation',
        type: 'Task',
        correlationId: 'test-correlation-123',
        assigneeResolution: {
          originalName: 'Jane Doe',
          resolved: false,
        },
      },
    ];

    it('should create valid Adaptive Card structure', () => {
      const card = createSummaryCard(sampleWorkItems, 'Sprint Planning') as any;

      expect(card.type).toBe('AdaptiveCard');
      expect(card.$schema).toBe('http://adaptivecards.io/schemas/adaptive-card.json');
      expect(card.version).toBe('1.5');
    });

    it('should include meeting subject', () => {
      const card = createSummaryCard(sampleWorkItems, 'Sprint Planning') as any;
      const cardJson = JSON.stringify(card);

      expect(cardJson).toContain('Sprint Planning');
    });

    it('should include work item count', () => {
      const card = createSummaryCard(sampleWorkItems, 'Test Meeting') as any;
      const cardJson = JSON.stringify(card);

      expect(cardJson).toContain('2 work items');
    });

    it('should include work item IDs and URLs', () => {
      const card = createSummaryCard(sampleWorkItems, 'Test Meeting') as any;
      const cardJson = JSON.stringify(card);

      expect(cardJson).toContain('#123');
      expect(cardJson).toContain('#124');
      expect(cardJson).toContain('https://dev.azure.com');
    });

    it('should include assignee information', () => {
      const card = createSummaryCard(sampleWorkItems, 'Test Meeting') as any;
      const cardJson = JSON.stringify(card);

      expect(cardJson).toContain('John Smith');
    });

    it('should include summary when provided', () => {
      const card = createSummaryCard(sampleWorkItems, 'Test', 'Meeting summary text') as any;
      const cardJson = JSON.stringify(card);

      expect(cardJson).toContain('Meeting summary text');
    });

    it('should include correlation ID when provided', () => {
      const card = createSummaryCard(sampleWorkItems, 'Test', undefined, 'corr-123') as any;
      const cardJson = JSON.stringify(card);

      expect(cardJson).toContain('corr-123');
    });

    it('should have body array', () => {
      const card = createSummaryCard(sampleWorkItems, 'Test') as any;

      expect(Array.isArray(card.body)).toBe(true);
      expect(card.body.length).toBeGreaterThan(0);
    });

    it('should have actions array', () => {
      const card = createSummaryCard(sampleWorkItems, 'Test') as any;

      expect(Array.isArray(card.actions)).toBe(true);
      expect(card.actions.length).toBeGreaterThan(0);
    });

    it('should handle empty work items array', () => {
      const card = createSummaryCard([], 'Empty Meeting') as any;

      expect(card.type).toBe('AdaptiveCard');
      const cardJson = JSON.stringify(card);
      expect(cardJson).toContain('0 work items');
    });
  });

  describe('createProcessingCard', () => {
    it('should create valid Adaptive Card structure', () => {
      const card = createProcessingCard('Test Meeting') as any;

      expect(card.type).toBe('AdaptiveCard');
      expect(card.$schema).toBeDefined();
      expect(card.version).toBeDefined();
    });

    it('should include meeting subject', () => {
      const card = createProcessingCard('Sprint Planning') as any;
      const cardJson = JSON.stringify(card);

      expect(cardJson).toContain('Sprint Planning');
    });

    it('should show processing message', () => {
      const card = createProcessingCard('Test') as any;
      const cardJson = JSON.stringify(card).toLowerCase();

      expect(cardJson).toContain('processing');
    });

    it('should include custom step message when provided', () => {
      const card = createProcessingCard('Test', 'Extracting action items...') as any;
      const cardJson = JSON.stringify(card);

      expect(cardJson).toContain('Extracting action items');
    });
  });

  describe('createErrorCard', () => {
    it('should create valid Adaptive Card structure', () => {
      const card = createErrorCard('Something went wrong') as any;

      expect(card.type).toBe('AdaptiveCard');
      expect(card.$schema).toBeDefined();
    });

    it('should display error message', () => {
      const card = createErrorCard('Transcript not found') as any;
      const cardJson = JSON.stringify(card);

      expect(cardJson).toContain('Transcript not found');
    });

    it('should include correlation ID when provided', () => {
      const card = createErrorCard('Error', 'corr-456') as any;
      const cardJson = JSON.stringify(card);

      expect(cardJson).toContain('corr-456');
    });

    it('should include suggestions when provided', () => {
      const card = createErrorCard('Error', undefined, [
        'Check transcript settings',
        'Try a different meeting',
      ]) as any;
      const cardJson = JSON.stringify(card);

      expect(cardJson).toContain('Check transcript settings');
      expect(cardJson).toContain('Try a different meeting');
    });

    it('should have retry action', () => {
      const card = createErrorCard('Error') as any;
      const cardJson = JSON.stringify(card);

      expect(cardJson).toContain('Try Again');
    });

    it('should use attention/error styling', () => {
      const card = createErrorCard('Error') as any;
      const cardJson = JSON.stringify(card).toLowerCase();

      expect(cardJson).toMatch(/attention|error/);
    });
  });

  describe('createMeetingListCard', () => {
    const sampleMeetings = [
      {
        id: 'meeting-1',
        subject: 'Sprint Planning',
        startDateTime: '2024-01-10T10:00:00Z',
      },
      {
        id: 'meeting-2',
        subject: 'Daily Standup',
        startDateTime: '2024-01-11T09:00:00Z',
      },
    ];

    it('should create valid Adaptive Card structure', () => {
      const card = createMeetingListCard(sampleMeetings) as any;

      expect(card.type).toBe('AdaptiveCard');
    });

    it('should include meeting subjects', () => {
      const card = createMeetingListCard(sampleMeetings) as any;
      const cardJson = JSON.stringify(card);

      expect(cardJson).toContain('Sprint Planning');
      expect(cardJson).toContain('Daily Standup');
    });

    it('should include meeting IDs as values', () => {
      const card = createMeetingListCard(sampleMeetings) as any;
      const cardJson = JSON.stringify(card);

      expect(cardJson).toContain('meeting-1');
      expect(cardJson).toContain('meeting-2');
    });

    it('should have process action', () => {
      const card = createMeetingListCard(sampleMeetings) as any;

      expect(Array.isArray(card.actions)).toBe(true);
      expect(card.actions.length).toBeGreaterThan(0);
    });

    it('should handle empty meeting list', () => {
      const card = createMeetingListCard([]) as any;

      expect(card.type).toBe('AdaptiveCard');
    });

    it('should handle meetings without subjects', () => {
      const meetings = [
        { id: 'meeting-1', subject: '', startDateTime: '2024-01-10T10:00:00Z' },
      ];
      const card = createMeetingListCard(meetings) as any;
      const cardJson = JSON.stringify(card);

      expect(cardJson).toContain('Untitled Meeting');
    });
  });

  describe('createWelcomeCard', () => {
    it('should create valid Adaptive Card structure', () => {
      const card = createWelcomeCard() as any;

      expect(card.type).toBe('AdaptiveCard');
    });

    it('should include ActionAgent branding', () => {
      const card = createWelcomeCard() as any;
      const cardJson = JSON.stringify(card);

      expect(cardJson).toContain('ActionAgent');
    });

    it('should have body content', () => {
      const card = createWelcomeCard() as any;

      expect(Array.isArray(card.body)).toBe(true);
      expect(card.body.length).toBeGreaterThan(0);
    });
  });

  describe('createHelpCard', () => {
    it('should create valid Adaptive Card structure', () => {
      const card = createHelpCard() as any;

      expect(card.type).toBe('AdaptiveCard');
    });

    it('should list available commands', () => {
      const card = createHelpCard() as any;
      const cardJson = JSON.stringify(card).toLowerCase();

      expect(cardJson).toContain('process');
      expect(cardJson).toContain('list');
      expect(cardJson).toContain('help');
    });

    it('should have body content', () => {
      const card = createHelpCard() as any;

      expect(Array.isArray(card.body)).toBe(true);
      expect(card.body.length).toBeGreaterThan(0);
    });
  });
});

describe('Card Accessibility', () => {
  it('should include alt text for images in welcome card', () => {
    const card = createWelcomeCard();
    const cardJson = JSON.stringify(card);

    if (cardJson.includes('"type":"Image"')) {
      expect(cardJson).toContain('altText');
    }
  });

  it('should include alt text for images in summary card', () => {
    const card = createSummaryCard([], 'Test');
    const cardJson = JSON.stringify(card);

    if (cardJson.includes('"type":"Image"')) {
      expect(cardJson).toContain('altText');
    }
  });
});
