-- 删除历史遗留的“无归属”档案/故事（owner_key 为空的记录）

delete from public.stories where owner_key = '';
delete from public.profiles where owner_key = '';

