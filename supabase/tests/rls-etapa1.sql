-- Controle-App / Etapa 1 - Verificação manual de RLS
-- Execute em ambiente de testes com usuários/auth UUIDs já criados.
-- Este arquivo não deve ser aplicado automaticamente.

\set admin_uid '00000000-0000-0000-0000-000000000001'
\set owner_uid '00000000-0000-0000-0000-000000000002'
\set manager_uid '00000000-0000-0000-0000-000000000003'
\set employee_uid '00000000-0000-0000-0000-000000000004'
\set outsider_uid '00000000-0000-0000-0000-000000000005'
\set company_id '10000000-0000-0000-0000-000000000001'
\set other_company_id '10000000-0000-0000-0000-000000000002'

-- Admin:
-- SELECT * FROM public.companies;
-- SELECT * FROM public.company_codes WHERE company_id = :'company_id';
-- SELECT * FROM public.memberships;
-- SELECT * FROM public.audit_log WHERE company_id = :'company_id';
-- UPDATE public.companies SET name = 'Nova empresa' WHERE id = :'company_id';
-- INSERT INTO public.companies(name) VALUES ('Nova empresa');
-- SELECT public.rotate_company_code(:'company_id');

-- Proprietário:
-- SELECT * FROM public.companies;
-- UPDATE public.companies SET phone = '11999999999' WHERE id = :'company_id';
-- SELECT * FROM public.company_codes WHERE company_id = :'company_id';
-- SELECT * FROM public.memberships WHERE company_id = :'company_id';
-- SELECT * FROM public.audit_log WHERE company_id = :'company_id';
-- Deve promover gerente/funcionário e desativar gerente/funcionário, mas não a si mesmo.
-- SELECT public.promote_to_manager('<membership_uuid>');
-- SELECT public.deactivate_member('<membership_uuid>');
-- Não deve selecionar/alterar empresas de outra companhia.

-- Gerente:
-- SELECT * FROM public.companies;
-- UPDATE public.companies SET photo = 'companies/<uuid>/foto.jpg' WHERE id = :'company_id';
-- SELECT * FROM public.company_codes WHERE company_id = :'company_id';
-- SELECT * FROM public.memberships WHERE company_id = :'company_id';
-- SELECT * FROM public.audit_log WHERE company_id = :'company_id';
-- Pode desativar somente funcionário.
-- Não pode promover, rotar código, criar proprietário ou desativar proprietário/gerente.

-- Funcionário:
-- SELECT * FROM public.memberships;                    -- apenas própria linha
-- SELECT * FROM public.companies;                      -- dados da própria empresa ativa
-- SELECT * FROM public.profiles;                       -- apenas o próprio perfil
-- SELECT * FROM public.company_codes;                  -- deve retornar zero linhas
-- SELECT * FROM public.audit_log;                      -- deve retornar zero linhas
-- SELECT * FROM public.memberships WHERE company_id <> :'company_id'; -- zero linhas
-- UPDATE public.memberships SET role = 'manager';      -- deve ser negado
-- UPDATE public.companies SET name = 'Indisponível';   -- deve ser negado
-- UPDATE public.profiles SET name = 'Meu nome', avatar_url = 'https://...'; -- próprio permitido

-- Terceiro sem membership:
-- SELECT * FROM public.companies;                      -- zero linhas
-- SELECT * FROM public.memberships;                    -- zero linhas
-- SELECT * FROM public.company_codes;                  -- zero linhas
-- SELECT * FROM public.audit_log;                      -- zero linhas
-- SELECT public.join_company_with_code('<código válido>'); -- cria vínculo employee

-- Troca de código:
-- 1. Admin executa SELECT public.rotate_company_code(:'company_id');
-- 2. O funcionário antigo tenta SELECT public.join_company_with_code('<código antigo>');
--    deve ser rejeitado com código inválido/inativo.
-- 3. O funcionário antigo tenta SELECT public.join_company_with_code('<código novo>');
--    membership deve continuar employee/active e code_id deve apontar para o código novo.
-- 4. Depois da troca, o funcionário desativado tenta entrar com o código novo;
--    deve continuar rejeitado como vínculo desativado.
-- SELECT id, role, active, code_id FROM public.memberships
-- WHERE company_id = :'company_id';

-- Promoção de cargos:
-- Como proprietário da empresa:
-- 1. SELECT public.promote_to_manager('<membership_employee_ativa_uuid>');
--    deve funcionar: role vira manager e code_id vira NULL.
-- 2. Tentar promover o vínculo de proprietário ativo deve ser rejeitado.
-- 3. Tentar promover o vínculo de gerente ativo deve ser rejeitado.
-- 4. Tentar promover vínculo employee desativado deve ser rejeitado.
-- Como gerente da mesma empresa:
-- 5. SELECT public.promote_to_manager('<membership_employee_ativa_uuid>');
--    deve ser rejeitado.
-- Como admin:
-- 6. Pode promover funcionário ativo da empresa.
-- Tentar usar um membership_id de outra empresa não muda o usuário do chamador:
-- 7. Proprietário só pode promover quando member_role da empresa alvo é owner.
-- SELECT id, role, active, code_id FROM public.memberships
-- WHERE id IN ('<employee_uuid>', '<owner_uuid>', '<manager_uuid>', '<inactive_uuid>');

-- Storage:
-- upload em company-photos/companies/<company_id>/foto.jpg:
--   ativo owner/manager/admin: permitido
--   employee: negado
--   sem membership: negado
-- leitura em company-photos: ativo da mesma empresa permitido
