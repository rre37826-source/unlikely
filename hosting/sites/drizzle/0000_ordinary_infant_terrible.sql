CREATE TABLE `trial_requests` (
	`request_id` text PRIMARY KEY NOT NULL,
	`session_hash` text NOT NULL,
	`ip_hash` text NOT NULL,
	`action` text NOT NULL,
	`day_bucket` text NOT NULL,
	`month_bucket` text NOT NULL,
	`reserved_microyuan` integer NOT NULL,
	`admitted_at` integer NOT NULL,
	`lease_until` integer NOT NULL,
	`completed_at` integer,
	`outcome` text,
	CONSTRAINT "trial_action_valid" CHECK("trial_requests"."action" IN ('generate', 'expand', 'synthesize')),
	CONSTRAINT "trial_reserved_positive" CHECK("trial_requests"."reserved_microyuan" > 0)
);
--> statement-breakpoint
CREATE INDEX `trial_month` ON `trial_requests` (`month_bucket`);--> statement-breakpoint
CREATE INDEX `trial_day` ON `trial_requests` (`day_bucket`);--> statement-breakpoint
CREATE INDEX `trial_session_day` ON `trial_requests` (`session_hash`,`day_bucket`);--> statement-breakpoint
CREATE INDEX `trial_ip_day` ON `trial_requests` (`ip_hash`,`day_bucket`);--> statement-breakpoint
CREATE INDEX `trial_lease` ON `trial_requests` (`lease_until`);