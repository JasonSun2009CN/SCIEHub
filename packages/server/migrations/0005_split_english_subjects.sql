-- Split the old combined English Literature / Language category.
-- Existing rows are moved to English Literature; admins can reclassify as needed.

UPDATE repos SET category_id = 'english-literature' WHERE category_id = 'english';
UPDATE groups SET category_id = 'english-literature' WHERE category_id = 'english';
