USE `getsocs_db`;
INSERT INTO memberships (id,name,price,platform_fee_reduction,payload) VALUES
('vip','VIP',9.99,0.04,JSON_OBJECT('id','vip','name','VIP','price',9.99,'platformFeeReduction',0.04,'dailyBoost',true,'glowBorder',false,'benefits',JSON_ARRAY('Reduced platform fee (4% instead of 5%)','1 daily listing boost','VIP badge on your profile and listings'))),
('vip_plus','VIP+',24.99,0.02,JSON_OBJECT('id','vip_plus','name','VIP+','price',24.99,'platformFeeReduction',0.02,'dailyBoost',true,'glowBorder',true,'benefits',JSON_ARRAY('Lowest platform fee (2% instead of 5%)','3 daily listing boosts','Glowing VIP+ badge on your profile and listings','Priority support')))
ON DUPLICATE KEY UPDATE name=VALUES(name), price=VALUES(price), platform_fee_reduction=VALUES(platform_fee_reduction), payload=VALUES(payload);

INSERT INTO addons (id,name,price,duration,payload) VALUES
('addon_username_color','Custom username color',4.99,'permanent',JSON_OBJECT('id','addon_username_color','name','Custom username color','price',4.99,'duration','permanent'))
ON DUPLICATE KEY UPDATE name=VALUES(name), price=VALUES(price), duration=VALUES(duration), payload=VALUES(payload);
