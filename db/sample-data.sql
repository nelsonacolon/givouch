-- OPTIONAL test data for UAT only. Every row is marked is_sample = TRUE.
-- These schools and reviews are made up. Remove them before launch with:
--   DELETE FROM programs WHERE is_sample;

INSERT INTO programs (school, school_type, program_name, field_of_study, format, city, state, country, va_listing_url, status, is_sample) VALUES
('Sample State University', 'college', 'B.S. Information Technology', 'Information technology', 'online', NULL, NULL, 'United States', 'https://www.va.gov/education/gi-bill-comparison-tool/', 'approved', TRUE),
('Sample Aviation Academy', 'flight', 'Commercial Pilot Certificate', 'Aviation', 'in_person', 'Tampa', 'FL', 'United States', 'https://www.va.gov/education/gi-bill-comparison-tool/', 'approved', TRUE),
('Sample Technical Institute', 'trade', 'HVAC Technician Certificate', 'Skilled trades', 'in_person', 'Orlando', 'FL', 'United States', 'https://www.va.gov/education/gi-bill-comparison-tool/', 'approved', TRUE),
('Universidad de Ejemplo', 'college', 'Master in International Business', 'Business', 'abroad', 'Madrid', NULL, 'Spain', 'https://www.va.gov/education/gi-bill-comparison-tool/', 'approved', TRUE);

INSERT INTO reviews (program_id, reviewer_email, display_name, attested_at, start_year, reviewer_status, benefit,
  overall_rating, paperwork_rating, worth_months, paid_on_time, credits_transferred, would_recommend, comment, status, is_sample)
SELECT id, 'sample@example.com', 'Sample reviewer', now(), 2023, 'veteran', 'Post-9/11 GI Bill',
  4, 4, 4, 'usually', 'partly', TRUE, 'Sample review for testing. Not a real experience.', 'published', TRUE
FROM programs WHERE is_sample AND school IN ('Sample State University', 'Universidad de Ejemplo');
