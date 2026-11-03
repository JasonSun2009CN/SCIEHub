-- Free-only library: legacy paid listings become free downloads.

UPDATE repos
   SET pricing_type = 'free',
       price = 0,
       currency = 'CNY';
