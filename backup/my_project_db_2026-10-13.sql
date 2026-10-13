--
-- PostgreSQL database dump
--

\restrict c0B8MmNlOzEkzKNYaVKD2hPNMFOHghKlOERNG7dcr7a53kL0dYvokWqTuVxr2pX

-- Dumped from database version 18.6
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: document_acknowledgements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_acknowledgements (
    id bigint NOT NULL,
    document_id bigint NOT NULL,
    version_no integer NOT NULL,
    user_id bigint NOT NULL,
    acknowledged_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: document_acknowledgements_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.document_acknowledgements_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: document_acknowledgements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.document_acknowledgements_id_seq OWNED BY public.document_acknowledgements.id;


--
-- Name: document_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_assignments (
    id bigint NOT NULL,
    document_id bigint NOT NULL,
    user_id bigint NOT NULL,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: document_assignments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.document_assignments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: document_assignments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.document_assignments_id_seq OWNED BY public.document_assignments.id;


--
-- Name: document_folders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_folders (
    id bigint NOT NULL,
    type text NOT NULL,
    parent_id bigint,
    name text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: document_folders_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.document_folders_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: document_folders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.document_folders_id_seq OWNED BY public.document_folders.id;


--
-- Name: document_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_versions (
    id bigint NOT NULL,
    document_id bigint NOT NULL,
    version_no integer NOT NULL,
    file_path text NOT NULL,
    original_filename text NOT NULL,
    mime_type text NOT NULL,
    change_reason text NOT NULL,
    created_by bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: document_versions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.document_versions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: document_versions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.document_versions_id_seq OWNED BY public.document_versions.id;


--
-- Name: documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.documents (
    id bigint NOT NULL,
    title text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    type text NOT NULL,
    number text DEFAULT ''::text NOT NULL,
    document_date date NOT NULL,
    due_date date NOT NULL,
    status text NOT NULL,
    author_id bigint NOT NULL,
    draft_file_path text,
    draft_original_filename text,
    draft_mime_type text,
    active_version_no integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by bigint,
    folder_id bigint,
    CONSTRAINT documents_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text])))
);


--
-- Name: documents_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.documents_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: documents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.documents_id_seq OWNED BY public.documents.id;


--
-- Name: email_template_folders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_template_folders (
    id bigint NOT NULL,
    parent_id bigint,
    name text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: email_template_folders_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.email_template_folders_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: email_template_folders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.email_template_folders_id_seq OWNED BY public.email_template_folders.id;


--
-- Name: email_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_templates (
    id bigint CONSTRAINT email_templates_new_id_not_null NOT NULL,
    folder_id bigint,
    trigger_kind text CONSTRAINT email_templates_new_trigger_kind_not_null NOT NULL,
    name text CONSTRAINT email_templates_new_name_not_null NOT NULL,
    subject text CONSTRAINT email_templates_new_subject_not_null NOT NULL,
    html_body text CONSTRAINT email_templates_new_html_body_not_null NOT NULL,
    is_default boolean DEFAULT false CONSTRAINT email_templates_new_is_default_not_null NOT NULL,
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT email_templates_new_updated_at_not_null NOT NULL,
    layout_kind text DEFAULT 'default'::text NOT NULL,
    CONSTRAINT email_templates_new_trigger_kind_check CHECK ((trigger_kind = ANY (ARRAY['publish'::text, 'new_version'::text])))
);


--
-- Name: email_templates_new_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.email_templates_new_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: email_templates_new_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.email_templates_new_id_seq OWNED BY public.email_templates.id;


--
-- Name: letter_template_folders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.letter_template_folders (
    id bigint NOT NULL,
    parent_id bigint,
    name text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: letter_template_folders_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.letter_template_folders_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: letter_template_folders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.letter_template_folders_id_seq OWNED BY public.letter_template_folders.id;


--
-- Name: letter_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.letter_templates (
    id bigint CONSTRAINT letter_templates_id_not_null1 NOT NULL,
    folder_id bigint,
    layout_kind text DEFAULT 'bakor_letter'::text CONSTRAINT letter_templates_layout_kind_not_null1 NOT NULL,
    name text DEFAULT ''::text CONSTRAINT letter_templates_name_not_null1 NOT NULL,
    subject text DEFAULT ''::text CONSTRAINT letter_templates_subject_not_null1 NOT NULL,
    html_body text DEFAULT ''::text NOT NULL,
    is_default boolean DEFAULT false CONSTRAINT letter_templates_is_default_not_null1 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT letter_templates_updated_at_not_null1 NOT NULL,
    CONSTRAINT letter_templates_layout_kind_check CHECK ((layout_kind = ANY (ARRAY['default'::text, 'bakor_letter'::text])))
);


--
-- Name: letter_templates_legacy; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.letter_templates_legacy (
    id bigint CONSTRAINT letter_templates_id_not_null NOT NULL,
    slug text CONSTRAINT letter_templates_slug_not_null NOT NULL,
    name text CONSTRAINT letter_templates_name_not_null NOT NULL,
    description text DEFAULT ''::text CONSTRAINT letter_templates_description_not_null NOT NULL,
    category text DEFAULT 'outgoing'::text CONSTRAINT letter_templates_category_not_null NOT NULL,
    header_html text DEFAULT ''::text CONSTRAINT letter_templates_header_html_not_null NOT NULL,
    footer_html text DEFAULT ''::text CONSTRAINT letter_templates_footer_html_not_null NOT NULL,
    body_skeleton jsonb DEFAULT '{"type": "doc", "content": []}'::jsonb CONSTRAINT letter_templates_body_skeleton_not_null NOT NULL,
    logo_path text,
    defaults jsonb DEFAULT '{}'::jsonb CONSTRAINT letter_templates_defaults_not_null NOT NULL,
    is_active boolean DEFAULT true CONSTRAINT letter_templates_is_active_not_null NOT NULL,
    created_by bigint,
    created_at timestamp with time zone DEFAULT now() CONSTRAINT letter_templates_created_at_not_null NOT NULL,
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT letter_templates_updated_at_not_null NOT NULL,
    folder_id bigint,
    layout_kind text DEFAULT 'bakor_letter'::text CONSTRAINT letter_templates_layout_kind_not_null NOT NULL,
    subject text DEFAULT ''::text CONSTRAINT letter_templates_subject_not_null NOT NULL,
    is_default boolean DEFAULT false CONSTRAINT letter_templates_is_default_not_null NOT NULL,
    CONSTRAINT letter_templates_layout_kind_check CHECK ((layout_kind = ANY (ARRAY['default'::text, 'bakor_letter'::text])))
);


--
-- Name: letter_templates_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.letter_templates_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: letter_templates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.letter_templates_id_seq OWNED BY public.letter_templates_legacy.id;


--
-- Name: letter_templates_id_seq1; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.letter_templates_id_seq1
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: letter_templates_id_seq1; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.letter_templates_id_seq1 OWNED BY public.letter_templates.id;


--
-- Name: letters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.letters (
    id bigint NOT NULL,
    template_id bigint,
    document_id bigint,
    author_id bigint NOT NULL,
    recipient text DEFAULT ''::text NOT NULL,
    recipient_contact text DEFAULT ''::text NOT NULL,
    sender text DEFAULT ''::text NOT NULL,
    address text DEFAULT ''::text NOT NULL,
    email text DEFAULT ''::text NOT NULL,
    outgoing_number integer DEFAULT 0 NOT NULL,
    outgoing_year integer DEFAULT (EXTRACT(year FROM now()))::integer NOT NULL,
    outgoing_date date DEFAULT CURRENT_DATE NOT NULL,
    body_json jsonb DEFAULT '{"type": "doc", "content": []}'::jsonb NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    docx_path text,
    docx_original_name text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    folder_id bigint,
    layout_kind text DEFAULT 'bakor_letter'::text NOT NULL,
    subject text DEFAULT ''::text NOT NULL,
    html_body text DEFAULT ''::text NOT NULL,
    to_emails text DEFAULT ''::text NOT NULL,
    sent_at timestamp with time zone,
    CONSTRAINT letters_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'sent'::text, 'confirmed'::text])))
);


--
-- Name: letters_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.letters_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: letters_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.letters_id_seq OWNED BY public.letters.id;


--
-- Name: outgoing_number_counters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.outgoing_number_counters (
    year integer NOT NULL,
    last_number integer DEFAULT 0 NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id bigint NOT NULL,
    full_name text NOT NULL,
    email text NOT NULL,
    password_hash text NOT NULL,
    role text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    password_encrypted text,
    CONSTRAINT users_role_check CHECK ((role = ANY (ARRAY['responsible'::text, 'employee'::text])))
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: document_acknowledgements id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_acknowledgements ALTER COLUMN id SET DEFAULT nextval('public.document_acknowledgements_id_seq'::regclass);


--
-- Name: document_assignments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_assignments ALTER COLUMN id SET DEFAULT nextval('public.document_assignments_id_seq'::regclass);


--
-- Name: document_folders id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_folders ALTER COLUMN id SET DEFAULT nextval('public.document_folders_id_seq'::regclass);


--
-- Name: document_versions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_versions ALTER COLUMN id SET DEFAULT nextval('public.document_versions_id_seq'::regclass);


--
-- Name: documents id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents ALTER COLUMN id SET DEFAULT nextval('public.documents_id_seq'::regclass);


--
-- Name: email_template_folders id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_template_folders ALTER COLUMN id SET DEFAULT nextval('public.email_template_folders_id_seq'::regclass);


--
-- Name: email_templates id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_templates ALTER COLUMN id SET DEFAULT nextval('public.email_templates_new_id_seq'::regclass);


--
-- Name: letter_template_folders id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.letter_template_folders ALTER COLUMN id SET DEFAULT nextval('public.letter_template_folders_id_seq'::regclass);


--
-- Name: letter_templates id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.letter_templates ALTER COLUMN id SET DEFAULT nextval('public.letter_templates_id_seq1'::regclass);


--
-- Name: letter_templates_legacy id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.letter_templates_legacy ALTER COLUMN id SET DEFAULT nextval('public.letter_templates_id_seq'::regclass);


--
-- Name: letters id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.letters ALTER COLUMN id SET DEFAULT nextval('public.letters_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: document_acknowledgements; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.document_acknowledgements (id, document_id, version_no, user_id, acknowledged_at) FROM stdin;
\.


--
-- Data for Name: document_assignments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.document_assignments (id, document_id, user_id, assigned_at) FROM stdin;
\.


--
-- Data for Name: document_folders; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.document_folders (id, type, parent_id, name, sort_order, created_at) FROM stdin;
14	legal_entity	\N	ИП Афанасьев Леонид	0	2026-09-14 08:17:55.425342+03
15	legal_entity	\N	ИП Афанасьев Никита	1	2026-09-14 08:18:16.168488+03
16	legal_entity	\N	ИП Каравосова Олеся	2	2026-09-14 08:19:14.448621+03
17	legal_entity	\N	ИП Карасев В.И.	3	2026-09-14 08:19:42.840853+03
18	legal_entity	\N	ИП Куров Денис	4	2026-09-14 08:19:56.600336+03
\.


--
-- Data for Name: document_versions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.document_versions (id, document_id, version_no, file_path, original_filename, mime_type, change_reason, created_by, created_at) FROM stdin;
38	23	1	documents/23/draft.doc	Карта партнера ИП Афанасьев Леонид.doc	application/msword	Первичная публикация	1	2026-09-14 08:22:56.230665+03
39	24	1	documents/24/draft.pdf	Карта партнера ИП Афанасьев Леонид.pdf	application/pdf	Первичная публикация	1	2026-09-14 08:23:22.780308+03
40	25	1	documents/25/draft.docx	Карта партнера ИП Афанасьев Никита.docx	application/vnd.openxmlformats-officedocument.wordprocessingml.document	Первичная публикация	1	2026-09-14 08:25:01.551582+03
41	26	1	documents/26/draft.docx	Карта партнера ИП Каравосова Олеся.docx	application/vnd.openxmlformats-officedocument.wordprocessingml.document	Первичная публикация	1	2026-09-14 08:27:08.043796+03
42	27	1	documents/27/draft.docx	Карта партнера ИП Карасев В.И..docx	application/vnd.openxmlformats-officedocument.wordprocessingml.document	Первичная публикация	1	2026-09-14 08:30:00.415364+03
43	28	1	documents/28/draft.docx	Карта партнера ИП Куров Денис.docx	application/vnd.openxmlformats-officedocument.wordprocessingml.document	Первичная публикация	1	2026-09-14 08:30:32.159061+03
44	29	1	documents/29/draft.pdf	ОГРНИП.pdf	application/pdf	Первичная публикация	1	2026-09-14 08:35:54.50492+03
45	30	1	documents/30/draft.pdf	Уведомление о постановке на учет.pdf	application/pdf	Первичная публикация	1	2026-09-14 08:36:52.543717+03
46	31	1	documents/31/draft.pdf	Лист записи ЕГРИП.pdf	application/pdf	Первичная публикация	1	2026-09-14 08:38:34.853068+03
47	32	1	documents/32/draft.pdf	Уведомление о постановке на учет.pdf	application/pdf	Первичная публикация	1	2026-09-14 08:38:58.300544+03
48	33	1	documents/33/draft.pdf	Лист записи в ЕГРИП.pdf	application/pdf	Первичная публикация	1	2026-09-14 08:39:41.131458+03
49	34	1	documents/34/draft.pdf	Уведомление о постановке на учет.pdf	application/pdf	Первичная публикация	1	2026-09-14 08:40:08.626311+03
50	35	1	documents/35/draft.pdf	ОГРНИП ИНН.pdf	application/pdf	Первичная публикация	1	2026-09-14 08:41:31.492286+03
\.


--
-- Data for Name: documents; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.documents (id, title, description, type, number, document_date, due_date, status, author_id, draft_file_path, draft_original_filename, draft_mime_type, active_version_no, created_at, updated_at, deleted_at, deleted_by, folder_id) FROM stdin;
26	Карта партнера ИП Каравосова Олеся		legal_entity	ЮЛ0004	2026-09-14	2026-09-28	published	1	documents/26/draft.docx	Карта партнера ИП Каравосова Олеся.docx	application/vnd.openxmlformats-officedocument.wordprocessingml.document	1	2026-09-14 08:27:04.201119+03	2026-09-14 08:27:08.043796+03	\N	\N	16
32	Уведомление о постановке на учет		legal_entity	ЮЛ0010	2026-09-14	2026-09-28	published	1	documents/32/draft.pdf	Уведомление о постановке на учет.pdf	application/pdf	1	2026-09-14 08:38:56.578546+03	2026-09-14 08:38:58.300544+03	\N	\N	16
27	Карта партнера ИП Карасев В.И.		legal_entity	ЮЛ0005	2026-09-14	2026-09-28	published	1	documents/27/draft.docx	Карта партнера ИП Карасев В.И..docx	application/vnd.openxmlformats-officedocument.wordprocessingml.document	1	2026-09-14 08:29:57.125613+03	2026-09-14 08:30:00.415364+03	\N	\N	17
30	Уведомление о постановке на учет		legal_entity	ЮЛ0008	2026-09-14	2026-09-28	published	1	documents/30/draft.pdf	Уведомление о постановке на учет.pdf	application/pdf	1	2026-09-14 08:36:49.757129+03	2026-09-14 08:36:52.543717+03	\N	\N	15
24	Карта партнера ИП Афанасьев Леонид		legal_entity	ЮЛ0002	2026-09-14	2026-09-28	published	1	documents/24/draft.pdf	Карта партнера ИП Афанасьев Леонид.pdf	application/pdf	1	2026-09-14 08:23:17.60893+03	2026-09-14 08:23:22.780308+03	\N	\N	14
28	Карта партнера ИП Куров Денис		legal_entity	ЮЛ0006	2026-09-14	2026-09-28	published	1	documents/28/draft.docx	Карта партнера ИП Куров Денис.docx	application/vnd.openxmlformats-officedocument.wordprocessingml.document	1	2026-09-14 08:30:25.838485+03	2026-09-14 08:30:32.159061+03	\N	\N	18
25	Карта партнера ИП Афанасьев Никита		legal_entity	ЮЛ0003	2026-09-14	2026-09-28	published	1	documents/25/draft.docx	Карта партнера ИП Афанасьев Никита.docx	application/vnd.openxmlformats-officedocument.wordprocessingml.document	1	2026-09-14 08:24:56.10065+03	2026-09-14 08:25:01.551582+03	\N	\N	15
29	ОГРНИП		legal_entity	ЮЛ0007	2026-09-14	2026-09-28	published	1	documents/29/draft.pdf	ОГРНИП.pdf	application/pdf	1	2026-09-14 08:35:51.952329+03	2026-10-09 10:09:26.089069+03	\N	\N	14
31	Лист записи ЕГРИП		legal_entity	ЮЛ0009	2026-09-14	2026-09-28	published	1	documents/31/draft.pdf	Лист записи ЕГРИП.pdf	application/pdf	1	2026-09-14 08:38:31.56388+03	2026-09-14 08:38:34.853068+03	\N	\N	16
23	Карта партнера ИП Афанасьев Леонид		legal_entity	ЮЛ0001	2026-09-14	2026-09-28	published	1	documents/23/draft.doc	Карта партнера ИП Афанасьев Леонид.doc	application/msword	1	2026-09-14 08:22:26.789292+03	2026-10-09 11:16:43.833545+03	\N	\N	14
34	Уведомление о постановке на учет		legal_entity	ЮЛ0012	2026-09-14	2026-09-28	published	1	documents/34/draft.pdf	Уведомление о постановке на учет.pdf	application/pdf	1	2026-09-14 08:40:06.9653+03	2026-09-14 08:40:08.626311+03	\N	\N	17
33	Лист записи в ЕГРИП		legal_entity	ЮЛ0011	2026-09-14	2026-09-28	published	1	documents/33/draft.pdf	Лист записи в ЕГРИП.pdf	application/pdf	1	2026-09-14 08:39:39.709661+03	2026-09-14 08:39:41.131458+03	\N	\N	17
35	ОГРНИП ИНН		legal_entity	ЮЛ0013	2026-09-14	2026-09-28	published	1	documents/35/draft.pdf	ОГРНИП ИНН.pdf	application/pdf	1	2026-09-14 08:41:27.833191+03	2026-10-13 09:13:17.569197+03	\N	\N	18
\.


--
-- Data for Name: email_template_folders; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.email_template_folders (id, parent_id, name, sort_order, created_at) FROM stdin;
\.


--
-- Data for Name: email_templates; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.email_templates (id, folder_id, trigger_kind, name, subject, html_body, is_default, updated_at, layout_kind) FROM stdin;
24	\N	publish	ООО «ЗСТ «ГИРД	Документ: {{title}}	<p style="margin-left:360px;"><strong><br>Кому: ООО «ЗСТ «ГИРД»<br>От: ООО «Компания Бакор»&nbsp;<br>Адрес: </strong>115522, г. Москва, вн.тер.г. муниципальный округ Москворечье-Сабурово, пр-кт Пролетарский, д. 17, к. 1, помещ. II, этаж 1, ком. 2, офис Б5Р<strong>&nbsp;<br>Тел.: </strong>+7 (927) 435-64-41<strong>&nbsp;<br>E-mail: </strong>vv@bakor.ru<strong><br>Исх. №___</strong></p><p><strong>Уважаемые партнеры!</strong></p><p>Рассмотрев вашу рекламацию от 21.04.2026 на топливный бак, поставленные по счёт-фактуре № 1664 от 14.04.2025, сообщаем следующее.</p><p>1<strong>. </strong>В паспорте топливного бака, раздел 5, пункт 5.8 указано:<br>«Производитель не несет ответственности за образование ржавчины внутри ТБ после его установки и в процессе его эксплуатации, равно как и за поломку топливной системы, вследствие этого».</p><p>Появление коррозии внутри стального бака напрямую зависит от условий хранения (влажность, перепады температур, попадание конденсата) и качества заливаемого топлива. Все эти факторы находятся вне контроля производителя. Поскольку при передаче баков коррозия отсутствовала, а выявлена она уже в процессе эксплуатации, данная ситуация не является гарантийным случаем.</p><p>2. Каждый бак снабжается наклейкой:</p><p>«Если при покупке бака обнаружили ржавчину внутри, ТРЕБУЙТЕ ЗАМЕНЫ БАКА».</p><p>Это означает, что покупатель обязан осмотреть внутреннюю поверхность при приёмке. Обращаем внимание, что при приёмке товара 14.04.2025 вы не заявляли о наличии коррозии. Таким образом, на момент передачи бак находился в надлежащем состоянии, а выявленные позже изменения относятся уже к периоду эксплуатации.</p><p>3. Гарантийный срок на стальную продукцию составляет 1 год с даты отгрузки. Поставка произведена 14.04.2025. Гарантия истекла 14.04.2026. Ваша рекламация подана 21.04.2026 - за пределами гарантийного срока.</p><p>На основании изложенного, руководствуясь условиями паспорта изделия, предупредительной маркировкой и истечением гарантийного срока, производитель отказывает в удовлетворении рекламации № 8658-1.</p><p>Вместе с тем, учитывая длительный характер сотрудничества, мы готовы обсудить индивидуальные условия при формировании следующего заказа.</p><p>С уважением, ООО «Компания БАКОР»</p>	f	2026-08-31 09:38:45.146198+03	bakor_letter
27	\N	publish	Ответ по течи бака	Документ: Ответ по течи бака	<p style="margin-left:240px;"><strong>Гражданину<br>Крецул Владимиру Афанасьевичу!</strong></p><p style="margin-left:240px;"><strong>От:&nbsp;ООО «Компания Бакор»<br>Адрес:&nbsp;</strong>115522 Г.Москва ВН.ТЕР.Г. МУНИЦИПАЛЬНЫЙ ОКРУГ</p><p style="margin-left:240px;">МОСКВОРЕЧЬЕ-САБУРОВО ПР-КТ ПРОЛЕТАРСКИЙ</p><p style="margin-left:240px;">Д. 17, К. 1 ПОМЕЩ. II ЭТАЖ 1 КОМ. 2 ОФИС Б5Р</p><p style="margin-left:240px;"><strong>Исх. № {{outgoingNumber}} от {{outgoingDate}}</strong></p><p><br><strong>Уважаемый Крецул Владимир Афанасьевич!</strong></p><p>Настоящим письмом окончательно и подробно отвечаем на ваше обращение по факту течи топливного бака ТБ 800 л (реализация 05.06.2025, № ДН000001280). Наша позиция по отказу в гарантийном обслуживании является правомерной, обоснованной и базируется на нормах действующего законодательства, а также на условиях нашей с вами договоренности.</p><p><strong>1. Специальные условия приобретения.</strong></p><p>Во время телефонного разговора от 30 апреля 2025 года сотрудник нашей компании уведомил Вас о невозможности установки бака за кабину, пояснив, что монтаж разрешён исключительно в штатное положение, и об отсутствии гарантийных обязательств в случае выбора другого места монтажа. Несмотря на это, по Вашей просьбе бак был изготовлен и Вами установлен вопреки данному запрету, при полном осведомлении о возможных рисках.&nbsp;<br><br>Подтверждением этому служит аудиозапись телефонного разговора, сохранённая в наших архивах, которая может быть предоставлена в рамках судебных разбирательств.</p><p><strong>2. Нарушение условий монтажа</strong></p><p>Ваш случай относится к обстоятельствам, предусмотренным пунктом 4.7 паспорта изделия, который требует точного соблюдения определённых норм монтажа, включая расположение кронштейнов на строго фиксированной высоте относительно друг друга и строго перпендикулярно продольной оси рамы транспортного средства.</p><p><br>Вы выбрали место установки, которое сделало невозможным точное соблюдение указанных требований, приведших впоследствии к образованию дефектов. Установка бака в выбранное вами место делает технически невозможным выполнение.</p><p>Эти обстоятельства соответствуют положениям статей 5 и 18 Федерального закона РФ «О защите прав потребителей», согласно которым продавец освобождается от ответственности за дефекты, возникающие вследствие нарушений правил монтажа или эксплуатации товара после передачи покупателю.</p><p><strong>Заключение</strong></p><p>На основании вышеизложенных фактов и законодательных положений, Ваша претензия не подлежит удовлетворению ввиду следующего:</p><p><strong>- Изделие приобретено Вами на специальных условиях, исключающих гарантию.</strong></p><p><strong>- Недостаток вызван действиями потребителя, противоречащими установленным правилам монтажа и эксплуатации.</strong></p><p><strong>Исходя из этого, Компания оставляет за собой право отказать в удовлетворении Ваших требований о возмещении убытков, бесплатном ремонте или замене изделия.</strong></p><p><strong>Контактная информация:</strong></p><p>Если возникнут дополнительные вопросы, обращайтесь к специалисту по качеству продукции:</p><ul><li data-list-item-id="ee6d3b369844659530fb6b295337277db">Телефон отдела качества: +7&nbsp;927&nbsp;435 64 41</li><li data-list-item-id="ef7b68b71736b2e72a283a3a6d988e470">E-mail:&nbsp;<a href="mailto:vv@bakor.ru">vv@bakor.ru</a></li></ul><p><br>С уважением, ООО «Компания БАКОР»</p><p>Специалист по вопросам качества и рекламаций<strong><img class="image_resized" style="aspect-ratio:390/257;width:8.32%;" src="data:image/png;base64,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" width="390" height="257"></strong> Юновидов Виталий Владимирович</p>	f	2026-08-31 10:08:09.816996+03	bakor_letter
41	\N	publish	Документ на ознакомление	Документ на ознакомление: {{title}}	<div style="font-family: Arial, sans-serif; line-height: 1.5; color: #1a1a1a;">\n  <p>Здравствуйте, {{fullName}}!</p>\n  <p>Вам направлен документ «<strong>{{title}}</strong>» на ознакомление.</p>\n  <p><strong>Автор:</strong> {{authorName}}</p>\n  <p><a href="{{link}}" style="display:inline-block;padding:10px 16px;background:#1f4b7a;color:#fff;text-decoration:none;border-radius:4px;">Открыть документ</a></p>\n  <p style="color:#666;font-size:12px;">Если кнопка не работает, скопируйте ссылку:<br>{{link}}</p>\n  <p style="color:#666;font-size:12px;">Реестр БАКОР</p>\n</div>	t	2026-09-02 10:46:05.577588+03	default
39	\N	publish	Новый шаблон	ООО РЦ «Автодилер»	<p>&nbsp;</p><p><strong><br>Кому: ООО РЦ «Автодилер»<br>От: ООО «Компания Бакор»&nbsp;<br>Адрес: </strong>115522, г. Москва, вн.тер.г. муниципальный округ Москворечье-Сабурово, пр-кт Пролетарский, д. 17, к. 1, помещ. II, этаж 1, ком. 2, офис Б5Р<strong>&nbsp;<br>E-mail: </strong><a href="mailto:vv@bakor.ru">vv@bakor.ru</a><br><strong>Исх. № {{outgoingNumber}} от {{outgoingDate}}</strong></p><p><strong>Уважаемый Сергей Александрович!</strong></p><p><strong>Настоящим сообщаем, что по результатам рассмотрения Вашего обращения, а также представленных документов и фотоматериалов, нами принято следующее решение.</strong></p><p><strong>1. Запрошенные для объективной оценки документы</strong></p><p>В соответствии с условиями гарантийного обслуживания, для проведения квалифицированной экспертизы заявленного дефекта (течь сварного шва) нами был запрошен следующий пакет материалов:</p><ul><li data-list-item-id="ed0618867deaf2c1b2643863eb1d41d04">документ, подтверждающий факт и дату приобретения изделия (кассовый или товарный чек, накладная);</li><li data-list-item-id="e64dae56ca3c9fb9c7623acb540ecbd87">фотографии сварного шва в месте течи крупным планом;</li><li data-list-item-id="ec0c5cbde33d47ce1a4e68c5a2e69f83c">фотография установки бака на автомобиле (общий вид, позволяющий оценить способ крепления и расположение);</li><li data-list-item-id="e3f21bb3f82652fac8f7780019631c00d">общий вид автомобиля.</li></ul><h3><strong>2. Фактически представленные материалы</strong></h3><p>Вами было направлено:</p><ul><li data-list-item-id="e5fa435c67561fd4a3a85166a725618a3">два фотографических снимка&nbsp;<strong>уже демонтированного бака</strong>&nbsp;(общий вид и изображение трещины на дне бака);</li><li data-list-item-id="e86aa48909b2f00ff3e4e446956cf2087">позднее - чек о покупке.</li></ul><p>Фотографии сварного шва (заявленного источника течи), а также сведения о монтаже бака на транспортном средстве и общем виде автомобиля предоставлены не были.</p><p><strong>3. Анализ и заключение производителя</strong></p><p>&nbsp;</p><div class="letter-page-turn" contenteditable="false" data-auto-page-break="true"><div class="letter-page-turn__footer-space">&nbsp;</div><div class="letter-page-turn__gap">&nbsp;</div><div class="letter-page-turn__header-space">&nbsp;</div></div><p>&nbsp;</p><p>3.1.&nbsp;Заявленный Вами дефект - течь сварного шва - не подтверждён документально и фотографически. Вместо этого представлено изображение трещины на днищевой части бака, которую Вы самостоятельно квалифицировали как&nbsp;не заводской брак, а эксплуатационное повреждение.</p><p>3.2.&nbsp;Производитель полностью разделяет данную оценку: характер трещины (локализация, форма краёв), зафиксированный на&nbsp;предоставленных вами фотоматериалах, типичен для механического воздействия, возникающего в процессе эксплуатации, монтажа, демонтажа или при контакте с внешними предметами. Гарантийные обязательства распространяются исключительно на скрытые производственные недостатки. На фотоматериалах, по которым вы ожидали от нас решения, признаки таких производственных дефектов отсутствуют.</p><p>3.3.&nbsp;Дополнительно обращаем внимание, что все фотоматериалы выполнены&nbsp;после демонтажа бака, без фиксации его штатного положения на автомобиле. Данное обстоятельство делает невозможным:</p><ul><li data-list-item-id="e0563475acd6efce0889230067fbbc1d9">оценку корректности установки и крепления;</li><li data-list-item-id="e08f7abed3a76ee7b48fe8fa28ab3ded0">выявление следов контакта с элементами кузова.</li><li data-list-item-id="e6268dd2325b3368d91078dbfa8693e78">проведение полноценной гарантийной экспертизы в соответствии с внутренними регламентами производителя.</li></ul><h3><strong>4. Решение</strong></h3><p>На основании вышеизложенного, руководствуясь условиями гарантийного обслуживания и положениями действующего законодательства, <strong>случай не подлежит квалификации как гарантийный.</strong></p><p>.</p><p>С уважением, ООО «Компания БАКОР»</p>	f	2026-08-31 12:01:25.079428+03	bakor_letter
40	\N	publish	Новый шаблон1	ООО РЦ «Автодилер»	<p><strong><br>Кому: ООО РЦ «Автодилер»<br>От: ООО «Компания Бакор»&nbsp;<br>Адрес: </strong>115522, г. Москва, вн.тер.г. муниципальный округ Москворечье-Сабурово, пр-кт Пролетарский, д. 17, к. 1, помещ. II, этаж 1, ком. 2, офис Б5Р<strong>&nbsp;<br>E-mail: </strong><a href="mailto:vv@bakor.ru">vv@bakor.ru</a><br><strong>Исх. № {{outgoingNumber}} от {{outgoingDate}}</strong></p><p><strong>Уважаемый Сергей Александрович!</strong></p><p><strong>Настоящим сообщаем, что по результатам рассмотрения Вашего обращения, а также представленных документов и фотоматериалов, нами принято следующее решение.</strong></p><p><strong>1. Запрошенные для объективной оценки документы</strong></p><p>В соответствии с условиями гарантийного обслуживания, для проведения квалифицированной экспертизы заявленного дефекта (течь сварного шва) нами был запрошен следующий пакет материалов:</p><ul><li data-list-item-id="e6a83ab5e0c7d25a4a156198ac8c47a26">документ, подтверждающий факт и дату приобретения изделия (кассовый или товарный чек, накладная);</li><li data-list-item-id="e316cdfe6ad22704c42e6dae51c7ea717">фотографии сварного шва в месте течи крупным планом;</li><li data-list-item-id="e072b0ad5ce87376d3a9fef5c6afaeb84">фотография установки бака на автомобиле (общий вид, позволяющий оценить способ крепления и расположение);</li><li data-list-item-id="e5f380be2f67414a92c77f4e8bb26b6cf">общий вид автомобиля.</li></ul><h3><strong>2. Фактически представленные материалы</strong></h3><p>Вами было направлено:</p><ul><li data-list-item-id="eb738859e629ac0c27b0c1e273d3c98a4">два фотографических снимка&nbsp;<strong>уже демонтированного бака</strong>&nbsp;(общий вид и изображение трещины на дне бака);</li><li data-list-item-id="e974aa5c62711b9bde46c420b01c27550">позднее - чек о покупке.</li></ul><p>Фотографии сварного шва (заявленного источника течи), а также сведения о монтаже бака на транспортном средстве и общем виде автомобиля предоставлены не были.</p><div class="letter-page-turn" aria-hidden="true" contenteditable="false" data-manual-page-break="true" title="Разрыв страницы"><div class="letter-page-turn__footer-space">&nbsp;</div><div class="letter-page-turn__gap">&nbsp;</div><div class="letter-page-turn__header-space">&nbsp;</div></div><p><strong>3. Анализ и заключение производителя</strong></p><p>3.1.&nbsp;Заявленный Вами дефект - течь сварного шва - не подтверждён документально и фотографически. Вместо этого представлено изображение трещины на днищевой части бака, которую Вы самостоятельно квалифицировали как&nbsp;не заводской брак, а эксплуатационное повреждение.</p><p>3.2.&nbsp;Производитель полностью разделяет данную оценку: характер трещины (локализация, форма краёв), зафиксированный на&nbsp;предоставленных вами фотоматериалах, типичен для механического воздействия, возникающего в процессе эксплуатации, монтажа, демонтажа или при контакте с внешними предметами. Гарантийные обязательства распространяются исключительно на скрытые производственные недостатки. На фотоматериалах, по которым вы ожидали от нас решения, признаки таких производственных дефектов отсутствуют.</p><p>3.3.&nbsp;Дополнительно обращаем внимание, что все фотоматериалы выполнены&nbsp;после демонтажа бака, без фиксации его штатного положения на автомобиле. Данное обстоятельство делает невозможным:</p><ul><li data-list-item-id="e216e2bbb861d21679ee662d7b3898b33">оценку корректности установки и крепления;</li><li data-list-item-id="ed5cba891eead9aa4aecd80bf43bbdfe7">выявление следов контакта с элементами кузова.</li><li data-list-item-id="e20ec2b633406ada2551c96d828fbb973">проведение полноценной гарантийной экспертизы в соответствии с внутренними регламентами производителя.</li></ul><h3><strong>4. Решение</strong></h3><p>На основании вышеизложенного, руководствуясь условиями гарантийного обслуживания и положениями действующего законодательства, <strong>случай не подлежит квалификации как гарантийный.</strong></p><p>.</p><p>С уважением, ООО «Компания БАКОР»</p>	f	2026-08-31 12:55:06.218226+03	bakor_letter
4	\N	publish	Ответ ООО РЦ «Автодилер»	Исх. № — {{title}}	<div class="letter-requisites">\n  <p><strong>Кому:</strong> ООО РЦ «Автодилер»</p>\n  <p><strong>От:</strong> ООО «Компания Бакор»</p>\n  <p><strong>Адрес:</strong> 115522, г. Москва, вн.тер.г. муниципальный округ<br>\n  Москворечье-Сабурово, пр-кт Пролетарский, д. 17, к. 1, помещ. II,<br>\n  этаж 1, ком. 2, офис Б5Р</p>\n  <p><strong>E-mail:</strong> <a href="mailto:vv@bakor.ru">vv@bakor.ru</a></p>\n  <p><strong>Исх. № 34 от 09.04.2026</strong></p>\n</div>\n\n<p class="letter-greeting">Уважаемый Сергей Александрович!</p>\n\n<p class="letter-body-justify">Настоящим сообщаем, что по результатам рассмотрения Вашего обращения, связанного с претензией по топливному баку, проведён анализ представленных материалов и технической документации.</p>\n\n<p class="letter-section-title">1. Запрошенные для объективной оценки документы</p>\n<p class="letter-body-justify">Для проведения объективной оценки и подготовки заключения производителя были запрошены следующие документы:</p>\n<ul>\n  <li>акт приёма-передачи изделия и сопроводительные документы;</li>\n  <li>фотоматериалы дефекта с разных ракурсов;</li>\n  <li>заключение сервисной организации с описанием выявленных несоответствий;</li>\n  <li>данные об условиях эксплуатации и истории обслуживания изделия.</li>\n</ul>\n\n<p class="letter-section-title">2. Фактически представленные материалы</p>\n<ul>\n  <li>фотографии внешнего вида изделия;</li>\n  <li>копия сопроводительного листа;</li>\n  <li>письмо с описанием обстоятельств возникновения претензии.</li>\n</ul>\n\n<p class="letter-section-title">3. Анализ и заключение производителя</p>\n<p class="letter-subsection">3.1. По результатам визуального осмотра представленных фотоматериалов установлено, что характер повреждения не позволяет однозначно отнести его к производственному дефекту без дополнительной экспертизы.</p>\n<p class="letter-subsection">3.2. Представленный комплект документов не содержит полного перечня сведений, необходимых для окончательного технического заключения.</p>\n<p class="letter-subsection">3.3. Для завершения анализа требуется предоставить:</p>\n<ul>\n  <li>оригинал или заверенную копию акта дефектации;</li>\n  <li>данные о наработке изделия и условиях эксплуатации;</li>\n  <li>заключение независимой экспертной организации (при наличии).</li>\n</ul>\n\n<p class="letter-section-title">4. Решение</p>\n<p class="letter-body-justify">На основании изложенного, окончательное решение по существу обращения может быть принято после получения недостающих документов и проведения полной технической оценки изделия.</p>\n\n<p class="letter-signoff">С уважением, ООО «Компания БАКОР»</p>	f	2026-09-02 10:46:04.670507+03	bakor_letter
38	\N	new_version	тест1	ООО РЦ «Автодилер»	<p style="margin-left:320px;"><strong><br>Кому: ООО РЦ «Автодилер»<br>От: ООО «Компания Бакор»&nbsp;<br>Адрес: </strong>115522, г. Москва, вн.тер.г. муниципальный округ Москворечье-Сабурово, пр-кт Пролетарский, д. 17, к. 1, помещ. II, этаж 1, ком. 2, офис Б5Р<strong>&nbsp;<br>E-mail: </strong><a href="mailto:vv@bakor.ru">vv@bakor.ru</a><br><strong>Исх. № {{outgoingNumber}} от {{outgoingDate}}</strong></p><p style="text-align:center;"><strong>Уважаемый Сергей Александрович!</strong></p><p><strong>Настоящим сообщаем, что по результатам рассмотрения Вашего обращения, а также представленных документов и фотоматериалов, нами принято следующее решение.</strong></p><p><strong>1. Запрошенные для объективной оценки документы</strong></p><p>В соответствии с условиями гарантийного обслуживания, для проведения квалифицированной экспертизы заявленного дефекта (течь сварного шва) нами был запрошен следующий пакет материалов:</p><ul><li data-list-item-id="ee7cb6837911ac7251088df1891873242">документ, подтверждающий факт и дату приобретения изделия (кассовый или товарный чек, накладная);</li><li data-list-item-id="ed7da278733025538681660c22d1c11f2">фотографии сварного шва в месте течи крупным планом;</li><li data-list-item-id="eb33afaeb6f0c44205e3d1386ebe2d88b">фотография установки бака на автомобиле (общий вид, позволяющий оценить способ крепления и расположение);</li><li data-list-item-id="e6e141180d702c684f13c90de2c8c0628">общий вид автомобиля.</li></ul><h3><strong>2. Фактически представленные материалы</strong></h3><p>Вами было направлено:</p><ul><li data-list-item-id="ed9b08e64c03149f3fba01964c2217fbc">два фотографических снимка&nbsp;<strong>уже демонтированного бака</strong>&nbsp;(общий вид и изображение трещины на дне бака);</li><li data-list-item-id="e4aeacd89dc82f32dd8c03ffe6161f58e">позднее - чек о покупке.</li></ul><p>Фотографии сварного шва (заявленного источника течи), а также сведения о монтаже бака на транспортном средстве и общем виде автомобиля предоставлены не были</p><p>&nbsp;</p><p>&nbsp;</p><p>&nbsp;</p><div class="letter-page-turn" contenteditable="false" data-auto-page-break="true"><div class="letter-page-turn__footer-space">&nbsp;</div><div class="letter-page-turn__gap">&nbsp;</div><div class="letter-page-turn__header-space">&nbsp;</div></div><p>&nbsp;</p><p>&nbsp;</p><p><strong>3. Анализ и заключение производителя</strong></p><p>3.1.&nbsp;Заявленный Вами дефект - течь сварного шва - не подтверждён документально и фотографически. Вместо этого представлено изображение трещины на днищевой части бака, которую Вы самостоятельно квалифицировали как&nbsp;не заводской брак, а эксплуатационное повреждение.</p><p>3.2.&nbsp;Производитель полностью разделяет данную оценку: характер трещины (локализация, форма краёв), зафиксированный на&nbsp;предоставленных вами фотоматериалах, типичен для механического воздействия, возникающего в процессе эксплуатации, монтажа, демонтажа или при контакте с внешними предметами. Гарантийные обязательства распространяются исключительно на скрытые производственные недостатки. На фотоматериалах, по которым вы ожидали от нас решения, признаки таких производственных дефектов отсутствуют.</p><p>3.3.&nbsp;Дополнительно обращаем внимание, что все фотоматериалы выполнены&nbsp;после демонтажа бака, без фиксации его штатного положения на автомобиле. Данное обстоятельство делает невозможным:</p><ul><li data-list-item-id="ecf5c6748c6768d1e3b7792a26834a56d">оценку корректности установки и крепления;</li><li data-list-item-id="e495666bf857f0135cd823859c7107f0c">выявление следов контакта с элементами кузова.</li><li data-list-item-id="e738bc81f03eabb845c3f43379ed4854c">проведение полноценной гарантийной экспертизы в соответствии с внутренними регламентами производителя.</li></ul><h3><strong>4. Решение</strong></h3><p>На основании вышеизложенного, руководствуясь условиями гарантийного обслуживания и положениями действующего законодательства, <strong>случай не подлежит квалификации как гарантийный.</strong></p><p>С уважением, ООО «Компания БАКОР»</p>	f	2026-09-02 10:46:04.670507+03	bakor_letter
42	\N	new_version	Новая версия документа	Новая версия документа: {{title}}	<div style="font-family: Arial, sans-serif; line-height: 1.5; color: #1a1a1a;">\n  <p>Здравствуйте, {{fullName}}!</p>\n  <p>Опубликована новая версия (v{{versionNo}}) документа «<strong>{{title}}</strong>».</p>\n  <p><strong>Автор:</strong> {{authorName}}</p>\n  {{changeReasonBlock}}\n  <p><a href="{{link}}" style="display:inline-block;padding:10px 16px;background:#1f4b7a;color:#fff;text-decoration:none;border-radius:4px;">Открыть документ</a></p>\n  <p style="color:#666;font-size:12px;">Если кнопка не работает, скопируйте ссылку:<br>{{link}}</p>\n  <p style="color:#666;font-size:12px;">Реестр БАКОР</p>\n</div>	t	2026-09-02 10:46:05.577588+03	default
\.


--
-- Data for Name: letter_template_folders; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.letter_template_folders (id, parent_id, name, sort_order, created_at) FROM stdin;
\.


--
-- Data for Name: letter_templates; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.letter_templates (id, folder_id, layout_kind, name, subject, html_body, is_default, updated_at) FROM stdin;
1	\N	bakor_letter	Стандартное письмо БАКОР		<div class="letter-requisites">\n  <p><strong>Кому:</strong> </p>\n  <p><strong>От:</strong> ООО «Компания Бакор»</p>\n  <p><strong>Адрес:</strong> 115522, г. Москва, вн.тер.г. муниципальный округ<br>\n  Москворечье-Сабурово, пр-кт Пролетарский, д. 17, к. 1, помещ. II,<br>\n  этаж 1, ком. 2, офис Б5Р</p>\n  <p><strong>E-mail:</strong> <a href="mailto:vv@bakor.ru">vv@bakor.ru</a></p>\n  <p><strong>Исх. № {{outgoingNumber}} от {{outgoingDate}}</strong></p>\n</div>\n\n<p class="letter-greeting">Уважаемый(ая) ...!</p>\n\n<p class="letter-body-justify">Текст письма...</p>\n\n<p class="letter-signoff">С уважением, ООО «Компания БАКОР»</p>	t	2026-09-02 10:37:32.700422+03
\.


--
-- Data for Name: letter_templates_legacy; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.letter_templates_legacy (id, slug, name, description, category, header_html, footer_html, body_skeleton, logo_path, defaults, is_active, created_by, created_at, updated_at, folder_id, layout_kind, subject, is_default) FROM stdin;
1	ответ-по-гарантийному-случаю	Ответ по гарантийному случаю	Формальный ответ клиенту с разделами 1–4 и списками материалов.	outgoing		<p>С уважением, ООО «Компания БАКОР»</p>	{"type": "doc", "content": [{"type": "paragraph", "content": [{"text": "Уважаемый {{recipient_contact}}!", "type": "text"}]}, {"type": "paragraph", "content": [{"text": "Настоящим сообщаем, что по результатам рассмотрения Вашего обращения проведён анализ представленных материалов.", "type": "text"}]}, {"type": "heading", "attrs": {"level": 3}, "content": [{"text": "1. Запрошенные для объективной оценки документы", "type": "text"}]}, {"type": "paragraph", "content": [{"text": "Для проведения экспертизы необходимо было представить следующие документы:", "type": "text"}]}, {"type": "bulletList", "content": [{"type": "listItem", "content": [{"type": "paragraph", "content": [{"text": "Пункт списка", "type": "text"}]}]}]}, {"type": "heading", "attrs": {"level": 3}, "content": [{"text": "2. Фактически представленные материалы", "type": "text"}]}, {"type": "bulletList", "content": [{"type": "listItem", "content": [{"type": "paragraph", "content": [{"text": "Пункт списка", "type": "text"}]}]}]}, {"type": "heading", "attrs": {"level": 3}, "content": [{"text": "3. Анализ и заключение производителя", "type": "text"}]}, {"type": "paragraph", "content": [{"text": "3.1. Опишите первый аспект анализа.", "type": "text"}]}, {"type": "heading", "attrs": {"level": 3}, "content": [{"text": "4. Решение", "type": "text"}]}, {"type": "paragraph", "content": [{"text": "На основании изложенного сообщаем следующее решение.", "type": "text"}]}]}	\N	{"email": "vv@bakor.ru", "sender": "ООО «Компания БАКОР»", "address": "115522, г. Москва, ул. Промышленная, д. 1", "recipient": "", "signatory": "С уважением, ООО «Компания БАКОР»", "recipientContact": ""}	t	\N	2026-08-28 09:42:57.288871+03	2026-08-28 09:42:57.288871+03	\N	bakor_letter		f
2	тест	тест		outgoing		<p>С уважением, ООО «Компания БАКОР»</p>	"{\\"type\\":\\"doc\\",\\"content\\":[{\\"type\\":\\"paragraph\\"}]}"	letter_templates/2/logo.png	{"email": "vv@bakor.ru", "sender": "ООО «Компания БАКОР»", "address": "115522, г. Москва, ул. Промышленная, д. 1", "recipient": "", "signatory": "С уважением, ООО «Компания БАКОР»", "recipientContact": ""}	f	1	2026-08-28 09:56:10.743152+03	2026-08-28 10:03:24.946191+03	\N	bakor_letter		f
\.


--
-- Data for Name: letters; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.letters (id, template_id, document_id, author_id, recipient, recipient_contact, sender, address, email, outgoing_number, outgoing_year, outgoing_date, body_json, status, docx_path, docx_original_name, created_at, updated_at, folder_id, layout_kind, subject, html_body, to_emails, sent_at) FROM stdin;
30	\N	\N	1						0	2026	2026-09-02	{"type": "doc", "content": []}	draft	\N	\N	2026-09-02 09:59:56.936345+03	2026-09-02 09:59:56.936345+03	\N	bakor_letter		<p></p>		\N
14	\N	\N	1						1	2026	2026-08-31	{"type": "doc", "content": []}	confirmed	\N	\N	2026-08-31 09:46:37.670539+03	2026-08-31 09:46:49.76919+03	\N	bakor_letter	Исх. № — {{title}}	<div class="letter-requisites"><p><strong>Кому:</strong> ООО РЦ «Автодилер»</p><p><strong>От:</strong> ООО «Компания Бакор»</p><p><strong>Адрес:</strong> 115522, г. Москва, вн.тер.г. муниципальный округ<br>Москворечье-Сабурово, пр-кт Пролетарский, д. 17, к. 1, помещ. II,<br>этаж 1, ком. 2, офис Б5Р</p><p><strong>E-mail:</strong> <a href="mailto:vv@bakor.ru">vv@bakor.ru</a></p><p><strong>Исх. № 1 от 31.08.2026</strong></p></div><p class="letter-greeting">Уважаемый Сергей Александрович!</p><p class="letter-body-justify">Настоящим сообщаем, что по результатам рассмотрения Вашего обращения, связанного с претензией по топливному баку, проведён анализ представленных материалов и технической документации.</p><p class="letter-section-title">1. Запрошенные для объективной оценки документы</p><p class="letter-body-justify">Для проведения объективной оценки и подготовки заключения производителя были запрошены следующие документы:</p><ul><li data-list-item-id="e0e81edca360551f78eb63a4e7886e71a">акт приёма-передачи изделия и сопроводительные документы;</li><li data-list-item-id="e4d0de2900e4d54ac3f40f556846bec3f">фотоматериалы дефекта с разных ракурсов;</li><li data-list-item-id="e0abe0d8d9b0c19c05da7cf7cd30649e7">заключение сервисной организации с описанием выявленных несоответствий;</li><li data-list-item-id="e82bb5fa0ba347244b28bca8c5b5713cb">данные об условиях эксплуатации и истории обслуживания изделия.</li></ul><p class="letter-section-title">2. Фактически представленные материалы</p><ul><li data-list-item-id="e046888202ff265273b381fffaace53f6">фотографии внешнего вида изделия;</li><li data-list-item-id="e0077ffa91063af0c28fd37caf35f2104">копия сопроводительного листа;</li><li data-list-item-id="e5d7d8accfa4f0f7b2a82d93adcd56a94">письмо с описанием обстоятельств возникновения претензии.</li></ul><p class="letter-section-title">3. Анализ и заключение производителя</p><p class="letter-subsection">3.1. По результатам визуального осмотра представленных фотоматериалов установлено, что характер повреждения не позволяет однозначно отнести его к производственному дефекту без дополнительной экспертизы.</p><p class="letter-subsection">3.2. Представленный комплект документов не содержит полного перечня сведений, необходимых для окончательного технического заключения.</p><p class="letter-subsection">3.3. Для завершения анализа требуется предоставить:</p><ul><li data-list-item-id="e338515a3de11ce2397c5c88cdd4dc6ce">оригинал или заверенную копию акта дефектации;</li><li data-list-item-id="e3db524f0c001e40d13f4da52fc0383a8">данные о наработке изделия и условиях эксплуатации;</li><li data-list-item-id="eff69c995f0d632cbe4bc139ddc0c8742">заключение независимой экспертной организации (при наличии).</li></ul><p class="letter-section-title">4. Решение</p><p class="letter-body-justify">На основании изложенного, окончательное решение по существу обращения может быть принято после получения недостающих документов и проведения полной технической оценки изделия.</p><p class="letter-signoff">С уважением, ООО «Компания БАКОР»</p>	ismarv04@gmail.com	2026-08-31 09:46:49.76919+03
16	\N	\N	1						2	2026	2026-08-31	{"type": "doc", "content": []}	confirmed	\N	\N	2026-08-31 09:49:57.278765+03	2026-08-31 09:50:12.837424+03	\N	bakor_letter	Исх. № — {{title}}	<div class="letter-requisites"><p><strong>Кому:</strong> ООО РЦ «Автодилер»</p><p><strong>От:</strong> ООО «Компания Бакор»</p><p><strong>Адрес:</strong> 115522, г. Москва, вн.тер.г. муниципальный округ<br>Москворечье-Сабурово, пр-кт Пролетарский, д. 17, к. 1, помещ. II,<br>этаж 1, ком. 2, офис Б5Р</p><p><strong>E-mail:</strong> <a href="mailto:vv@bakor.ru">vv@bakor.ru</a></p><p><strong>Исх. № 2 от 31.08.2026</strong></p></div><p class="letter-greeting">Уважаемый Сергей Александрович!</p><p class="letter-body-justify">Настоящим сообщаем, что по результатам рассмотрения Вашего обращения, связанного с претензией по топливному баку, проведён анализ представленных материалов и технической документации.</p><p class="letter-section-title">1. Запрошенные для объективной оценки документы</p><p class="letter-body-justify">Для проведения объективной оценки и подготовки заключения производителя были запрошены следующие документы:</p><ul><li data-list-item-id="e1e433d3de41435fe5c44e2fcd153cde1">акт приёма-передачи изделия и сопроводительные документы;</li><li data-list-item-id="ec1f46199a688e08b973f807700586234">фотоматериалы дефекта с разных ракурсов;</li><li data-list-item-id="eda1c526fc64ed88c6375a43d495e38de">заключение сервисной организации с описанием выявленных несоответствий;</li><li data-list-item-id="e9739a24a2027fc78b88332cac554422d">данные об условиях эксплуатации и истории обслуживания изделия.</li></ul><p class="letter-section-title">2. Фактически представленные материалы</p><ul><li data-list-item-id="e0aad739562c2ae7f8d9cb79210d75d6d">фотографии внешнего вида изделия;</li><li data-list-item-id="e76cdbb34cbd6e9c62086ae1e9efc3395">копия сопроводительного листа;</li><li data-list-item-id="ee0d73141e8d2b74fdcc67f4812253cb0">письмо с описанием обстоятельств возникновения претензии.</li></ul><p class="letter-section-title">3. Анализ и заключение производителя</p><p class="letter-subsection">3.1. По результатам визуального осмотра представленных фотоматериалов установлено, что характер повреждения не позволяет однозначно отнести его к производственному дефекту без дополнительной экспертизы.</p><p class="letter-subsection">3.2. Представленный комплект документов не содержит полного перечня сведений, необходимых для окончательного технического заключения.</p><p class="letter-subsection">3.3. Для завершения анализа требуется предоставить:</p><ul><li data-list-item-id="e5cf7dc981c43b0cd8958691888aed824">оригинал или заверенную копию акта дефектации;</li><li data-list-item-id="e7d99c791c068d24d1277257d9f68b24f">данные о наработке изделия и условиях эксплуатации;</li><li data-list-item-id="e41ddca8b9a0207b12644166b3cdaf313">заключение независимой экспертной организации (при наличии).</li></ul><p class="letter-section-title">4. Решение</p><p class="letter-body-justify">На основании изложенного, окончательное решение по существу обращения может быть принято после получения недостающих документов и проведения полной технической оценки изделия.</p><p class="letter-signoff">С уважением, ООО «Компания БАКОР»</p>		2026-08-31 09:50:12.837424+03
20	\N	\N	1						3	2026	2026-08-31	{"type": "doc", "content": []}	confirmed	\N	\N	2026-08-31 10:24:09.236262+03	2026-08-31 10:24:37.024476+03	\N	bakor_letter	ООО РЦ «Бакорт»	<div class="letter-requisites"><p><strong>Кому:</strong> ООО РЦ «Бакорт»</p><p><strong>От:</strong> ООО «Компания Бакор»</p><p><strong>Адрес:</strong> 115522, г. Москва, вн.тер.г. муниципальный округ<br>Москворечье-Сабурово, пр-кт Пролетарский, д. 17, к. 1, помещ. II,<br>этаж 1, ком. 2, офис Б5Р</p><p><strong>E-mail:</strong> <a href="mailto:vv@bakor.ru">vv@bakor.ru</a></p><p><strong>Исх. № 3 от 31.08.2026</strong></p></div><p class="letter-greeting">Уважаемый Сергей Александрович!</p><p class="letter-body-justify">Настоящим сообщаем, что по результатам рассмотрения Вашего обращения, связанного с претензией по топливному баку, проведён анализ представленных материалов и технической документации.</p><p class="letter-section-title">1. Запрошенные для объективной оценки документы</p><p class="letter-body-justify">Для проведения объективной оценки и подготовки заключения производителя были запрошены следующие документы:</p><ul><li data-list-item-id="e66b8b86435bb5450e73af4449a9096e5">акт приёма-передачи изделия и сопроводительные документы;</li><li data-list-item-id="e33aae2f9c6c524ab126fd21c15d265c4">фотоматериалы дефекта с разных ракурсов;</li><li data-list-item-id="eb43908b4efdc264ce59f13f6a6caccb4">заключение сервисной организации с описанием выявленных несоответствий;</li><li data-list-item-id="e6f8f0088089877abc832b746d23fe533">данные об условиях эксплуатации и истории обслуживания изделия.</li></ul><p class="letter-section-title">2. Фактически представленные материалы</p><ul><li data-list-item-id="e5c3d64ce005080a303b6dbc9613582ed">фотографии внешнего вида изделия;</li><li data-list-item-id="ecb81b2d46992326a5536f57c7bfae299">копия сопроводительного листа;</li><li data-list-item-id="e41a296770952f693ea326ec098f85406">письмо с описанием обстоятельств возникновения претензии.</li></ul><p class="letter-section-title">3. Анализ и заключение производителя</p><p class="letter-subsection">3.1. По результатам визуального осмотра представленных фотоматериалов установлено, что характер повреждения не позволяет однозначно отнести его к производственному дефекту без дополнительной экспертизы.</p><p class="letter-subsection">3.2. Представленный комплект документов не содержит полного перечня сведений, необходимых для окончательного технического заключения.</p><p class="letter-subsection">3.3. Для завершения анализа требуется предоставить:</p><ul><li data-list-item-id="e4ffcc451793979a8fc0f4faa31eafb70">оригинал или заверенную копию акта дефектации;</li><li data-list-item-id="e6de38be906a99798701c3aea65cb76f4">данные о наработке изделия и условиях эксплуатации;</li><li data-list-item-id="e7debdc29a799553dcd2a2cf554dc59e7">заключение независимой экспертной организации (при наличии).</li></ul><p class="letter-section-title">4. Решение</p><p class="letter-body-justify">На основании изложенного, окончательное решение по существу обращения может быть принято после получения недостающих документов и проведения полной технической оценки изделия.</p><p class="letter-signoff">С уважением, ООО «Компания БАКОР»</p>		2026-08-31 10:24:37.024476+03
28	\N	\N	1						4	2026	2026-08-31	{"type": "doc", "content": []}	confirmed	\N	\N	2026-08-31 12:55:10.375409+03	2026-08-31 13:12:07.325969+03	\N	default	ООО РЦ «Автодилер»	<p style="margin-left:360px;"><strong><br>Кому: ООО РЦ «Автодилер»<br>От: ООО «Компания Бакор»&nbsp;<br>Адрес: </strong>115522, г. Москва, вн.тер.г. муниципальный округ Москворечье-Сабурово, пр-кт Пролетарский, д. 17, к. 1, помещ. II, этаж 1, ком. 2, офис Б5Р<strong>&nbsp;<br>E-mail: </strong><a href="mailto:vv@bakor.ru">vv@bakor.ru</a><br><strong>Исх. № 4 от 31.08.2026</strong></p><p style="text-align:center;"><strong>Уважаемый Сергей Александрович!</strong></p><p><strong>Настоящим сообщаем, что по результатам рассмотрения Вашего обращения, а также представленных документов и фотоматериалов, нами принято следующее решение.</strong></p><p><strong>1. Запрошенные для объективной оценки документы</strong></p><p>В соответствии с условиями гарантийного обслуживания, для проведения квалифицированной экспертизы заявленного дефекта (течь сварного шва) нами был запрошен следующий пакет материалов:</p><ul><li data-list-item-id="e6a83ab5e0c7d25a4a156198ac8c47a26">документ, подтверждающий факт и дату приобретения изделия (кассовый или товарный чек, накладная);</li><li data-list-item-id="e316cdfe6ad22704c42e6dae51c7ea717">фотографии сварного шва в месте течи крупным планом;</li><li data-list-item-id="e072b0ad5ce87376d3a9fef5c6afaeb84">фотография установки бака на автомобиле (общий вид, позволяющий оценить способ крепления и расположение);</li><li data-list-item-id="e5f380be2f67414a92c77f4e8bb26b6cf">общий вид автомобиля.</li></ul><h3><strong>2. Фактически представленные материалы</strong></h3><p>Вами было направлено:</p><ul><li data-list-item-id="eb738859e629ac0c27b0c1e273d3c98a4">два фотографических снимка&nbsp;<strong>уже демонтированного бака</strong>&nbsp;(общий вид и изображение трещины на дне бака);</li><li data-list-item-id="e974aa5c62711b9bde46c420b01c27550">позднее - чек о покупке.</li></ul><p>Фотографии сварного шва (заявленного источника течи), а также сведения о монтаже бака на транспортном средстве и общем виде автомобиля предоставлены не были.</p><div class="letter-page-turn" aria-hidden="true" contenteditable="false" data-manual-page-break="true" title="Разрыв страницы"><div class="letter-page-turn__footer-space">&nbsp;</div><div class="letter-page-turn__gap">&nbsp;</div><div class="letter-page-turn__header-space">&nbsp;</div></div><p><strong>3. Анализ и заключение производителя</strong></p><p>3.1.&nbsp;Заявленный Вами дефект - течь сварного шва - не подтверждён документально и фотографически. Вместо этого представлено изображение трещины на днищевой части бака, которую Вы самостоятельно квалифицировали как&nbsp;не заводской брак, а эксплуатационное повреждение.</p><p>3.2.&nbsp;Производитель полностью разделяет данную оценку: характер трещины (локализация, форма краёв), зафиксированный на&nbsp;предоставленных вами фотоматериалах, типичен для механического воздействия, возникающего в процессе эксплуатации, монтажа, демонтажа или при контакте с внешними предметами. Гарантийные обязательства распространяются исключительно на скрытые производственные недостатки. На фотоматериалах, по которым вы ожидали от нас решения, признаки таких производственных дефектов отсутствуют.</p><p>3.3.&nbsp;Дополнительно обращаем внимание, что все фотоматериалы выполнены&nbsp;после демонтажа бака, без фиксации его штатного положения на автомобиле. Данное обстоятельство делает невозможным:</p><ul><li data-list-item-id="e216e2bbb861d21679ee662d7b3898b33">оценку корректности установки и крепления;</li><li data-list-item-id="ed5cba891eead9aa4aecd80bf43bbdfe7">выявление следов контакта с элементами кузова.</li><li data-list-item-id="e20ec2b633406ada2551c96d828fbb973">проведение полноценной гарантийной экспертизы в соответствии с внутренними регламентами производителя.</li></ul><h3><strong>4. Решение</strong></h3><p>На основании вышеизложенного, руководствуясь условиями гарантийного обслуживания и положениями действующего законодательства, <strong>случай не подлежит квалификации как гарантийный.</strong></p><p>С уважением, ООО «Компания БАКОР»</p>		2026-08-31 13:12:07.325969+03
29	\N	\N	1						5	2026	2026-08-31	{"type": "doc", "content": []}	confirmed	\N	\N	2026-08-31 13:12:45.626184+03	2026-08-31 13:23:17.56242+03	\N	bakor_letter	ООО РЦ «Автодилер»	<p><strong><br>Кому: ООО РЦ «Автодилер»<br>От: ООО «Компания Бакор»&nbsp;<br>Адрес: </strong>115522, г. Москва, вн.тер.г. муниципальный округ Москворечье-Сабурово, пр-кт Пролетарский, д. 17, к. 1, помещ. II, этаж 1, ком. 2, офис Б5Р<strong>&nbsp;<br>E-mail: </strong><a href="mailto:vv@bakor.ru">vv@bakor.ru</a><br><strong>Исх. № 5 от 31.08.2026</strong></p><p><strong>Уважаемый Сергей Александрович!</strong></p><p><strong>Настоящим сообщаем, что по результатам рассмотрения Вашего обращения, а также представленных документов и фотоматериалов, нами принято следующее решение.</strong></p><p><strong>1. Запрошенные для объективной оценки документы</strong></p><p>В соответствии с условиями гарантийного обслуживания, для проведения квалифицированной экспертизы заявленного дефекта (течь сварного шва) нами был запрошен следующий пакет материалов:</p><ul><li data-list-item-id="e6a83ab5e0c7d25a4a156198ac8c47a26">документ, подтверждающий факт и дату приобретения изделия (кассовый или товарный чек, накладная);</li><li data-list-item-id="e316cdfe6ad22704c42e6dae51c7ea717">фотографии сварного шва в месте течи крупным планом;</li><li data-list-item-id="e072b0ad5ce87376d3a9fef5c6afaeb84">фотография установки бака на автомобиле (общий вид, позволяющий оценить способ крепления и расположение);</li><li data-list-item-id="e5f380be2f67414a92c77f4e8bb26b6cf">общий вид автомобиля.</li></ul><h3><strong>2. Фактически представленные материалы</strong></h3><p>Вами было направлено:</p><ul><li data-list-item-id="eb738859e629ac0c27b0c1e273d3c98a4">два фотографических снимка&nbsp;<strong>уже демонтированного бака</strong>&nbsp;(общий вид и изображение трещины на дне бака);</li><li data-list-item-id="e974aa5c62711b9bde46c420b01c27550">позднее - чек о покупке.</li></ul><p>Фотографии сварного шва (заявленного источника течи), а также сведения о монтаже бака на транспортном средстве и общем виде автомобиля предоставлены не были.</p><div class="letter-page-turn" aria-hidden="true" contenteditable="false" data-manual-page-break="true" title="Разрыв страницы"><div class="letter-page-turn__footer-space">&nbsp;</div><div class="letter-page-turn__gap">&nbsp;</div><div class="letter-page-turn__header-space">&nbsp;</div></div><p><strong>3. Анализ и заключение производителя</strong></p><p>3.1.&nbsp;Заявленный Вами дефект - течь сварного шва - не подтверждён документально и фотографически. Вместо этого представлено изображение трещины на днищевой части бака, которую Вы самостоятельно квалифицировали как&nbsp;не заводской брак, а эксплуатационное повреждение.</p><p>3.2.&nbsp;Производитель полностью разделяет данную оценку: характер трещины (локализация, форма краёв), зафиксированный на&nbsp;предоставленных вами фотоматериалах, типичен для механического воздействия, возникающего в процессе эксплуатации, монтажа, демонтажа или при контакте с внешними предметами. Гарантийные обязательства распространяются исключительно на скрытые производственные недостатки. На фотоматериалах, по которым вы ожидали от нас решения, признаки таких производственных дефектов отсутствуют.</p><p>3.3.&nbsp;Дополнительно обращаем внимание, что все фотоматериалы выполнены&nbsp;после демонтажа бака, без фиксации его штатного положения на автомобиле. Данное обстоятельство делает невозможным:</p><ul><li data-list-item-id="e216e2bbb861d21679ee662d7b3898b33">оценку корректности установки и крепления;</li><li data-list-item-id="ed5cba891eead9aa4aecd80bf43bbdfe7">выявление следов контакта с элементами кузова.</li><li data-list-item-id="e20ec2b633406ada2551c96d828fbb973">проведение полноценной гарантийной экспертизы в соответствии с внутренними регламентами производителя.</li></ul><h3><strong>4. Решение</strong></h3><p>На основании вышеизложенного, руководствуясь условиями гарантийного обслуживания и положениями действующего законодательства, <strong>случай не подлежит квалификации как гарантийный.</strong></p><p>&nbsp;</p><p>С уважением, ООО «Компания БАКОР»</p>		2026-08-31 13:23:17.56242+03
\.


--
-- Data for Name: outgoing_number_counters; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.outgoing_number_counters (year, last_number) FROM stdin;
2026	7
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, full_name, email, password_hash, role, is_active, created_at, password_encrypted) FROM stdin;
11030	Ганиев Даниил Игоревич	ganiev@bakor.pro	$2b$10$CaFI6E7YqrcqmjFUGOTfyuUGD3zTJImLCy7FM9vU.Vs7BxtiJ1VGC	employee	t	2026-10-13 10:23:58.460466+03	O/Di/vpG6zn8DcSVE8bTAOjYUWI+Pxka4UkSaWclYFM84bszPd0=
11031	Куров Антон Олегович	anton@bakor.pro	$2b$10$V1G5NjGq2cZGTVVoemTTzuksckq7nuRSzFbhczFYw/LhLFXshYEM6	responsible	t	2026-10-13 10:26:39.218469+03	t4Ln+DenzYkY8alTYMWNUjOtj6ZeKdy2P0XB72Ho7vFuLcAG8/A=
1	Иван Петров	responsible@bakor.local	$2b$10$zR665TKajcE89y7LwFJi2uAwo/PX2qT9WDdmxe7IVD1zYcsRAa3LG	responsible	t	2026-08-18 15:29:02.098856+03	vj+nOwAR1GhiKVvHBhn8xpBNwAPaS2XKO9BVw69nKvW5KL7cXA==
\.


--
-- Name: document_acknowledgements_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.document_acknowledgements_id_seq', 21, true);


--
-- Name: document_assignments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.document_assignments_id_seq', 45, true);


--
-- Name: document_folders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.document_folders_id_seq', 18, true);


--
-- Name: document_versions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.document_versions_id_seq', 52, true);


--
-- Name: documents_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.documents_id_seq', 38, true);


--
-- Name: email_template_folders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.email_template_folders_id_seq', 1, false);


--
-- Name: email_templates_new_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.email_templates_new_id_seq', 42, true);


--
-- Name: letter_template_folders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.letter_template_folders_id_seq', 1, false);


--
-- Name: letter_templates_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.letter_templates_id_seq', 4, true);


--
-- Name: letter_templates_id_seq1; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.letter_templates_id_seq1', 1, true);


--
-- Name: letters_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.letters_id_seq', 32, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.users_id_seq', 11031, true);


--
-- Name: document_acknowledgements document_acknowledgements_document_id_version_no_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_acknowledgements
    ADD CONSTRAINT document_acknowledgements_document_id_version_no_user_id_key UNIQUE (document_id, version_no, user_id);


--
-- Name: document_acknowledgements document_acknowledgements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_acknowledgements
    ADD CONSTRAINT document_acknowledgements_pkey PRIMARY KEY (id);


--
-- Name: document_assignments document_assignments_document_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_assignments
    ADD CONSTRAINT document_assignments_document_id_user_id_key UNIQUE (document_id, user_id);


--
-- Name: document_assignments document_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_assignments
    ADD CONSTRAINT document_assignments_pkey PRIMARY KEY (id);


--
-- Name: document_folders document_folders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_folders
    ADD CONSTRAINT document_folders_pkey PRIMARY KEY (id);


--
-- Name: document_versions document_versions_document_id_version_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_versions
    ADD CONSTRAINT document_versions_document_id_version_no_key UNIQUE (document_id, version_no);


--
-- Name: document_versions document_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_versions
    ADD CONSTRAINT document_versions_pkey PRIMARY KEY (id);


--
-- Name: documents documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);


--
-- Name: email_template_folders email_template_folders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_template_folders
    ADD CONSTRAINT email_template_folders_pkey PRIMARY KEY (id);


--
-- Name: email_templates email_templates_new_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_templates
    ADD CONSTRAINT email_templates_new_pkey PRIMARY KEY (id);


--
-- Name: letter_template_folders letter_template_folders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.letter_template_folders
    ADD CONSTRAINT letter_template_folders_pkey PRIMARY KEY (id);


--
-- Name: letter_templates_legacy letter_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.letter_templates_legacy
    ADD CONSTRAINT letter_templates_pkey PRIMARY KEY (id);


--
-- Name: letter_templates letter_templates_pkey1; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.letter_templates
    ADD CONSTRAINT letter_templates_pkey1 PRIMARY KEY (id);


--
-- Name: letter_templates_legacy letter_templates_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.letter_templates_legacy
    ADD CONSTRAINT letter_templates_slug_key UNIQUE (slug);


--
-- Name: letters letters_outgoing_number_outgoing_year_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.letters
    ADD CONSTRAINT letters_outgoing_number_outgoing_year_key UNIQUE (outgoing_number, outgoing_year);


--
-- Name: letters letters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.letters
    ADD CONSTRAINT letters_pkey PRIMARY KEY (id);


--
-- Name: outgoing_number_counters outgoing_number_counters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outgoing_number_counters
    ADD CONSTRAINT outgoing_number_counters_pkey PRIMARY KEY (year);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_document_acks_document_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_acks_document_version ON public.document_acknowledgements USING btree (document_id, version_no);


--
-- Name: idx_document_assignments_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_assignments_user_id ON public.document_assignments USING btree (user_id);


--
-- Name: idx_document_folders_parent_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_folders_parent_id ON public.document_folders USING btree (parent_id);


--
-- Name: idx_document_folders_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_folders_type ON public.document_folders USING btree (type);


--
-- Name: idx_document_versions_document_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_versions_document_id ON public.document_versions USING btree (document_id);


--
-- Name: idx_documents_author_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_author_id ON public.documents USING btree (author_id);


--
-- Name: idx_documents_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_deleted_at ON public.documents USING btree (deleted_at) WHERE (deleted_at IS NOT NULL);


--
-- Name: idx_documents_folder_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_folder_id ON public.documents USING btree (folder_id);


--
-- Name: idx_documents_type_number_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_documents_type_number_unique ON public.documents USING btree (type, number) WHERE (TRIM(BOTH FROM COALESCE(number, ''::text)) <> ''::text);


--
-- Name: idx_email_template_folders_parent_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_template_folders_parent_id ON public.email_template_folders USING btree (parent_id);


--
-- Name: idx_email_templates_default_trigger; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_email_templates_default_trigger ON public.email_templates USING btree (trigger_kind) WHERE (is_default = true);


--
-- Name: idx_email_templates_folder_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_templates_folder_id ON public.email_templates USING btree (folder_id);


--
-- Name: idx_letter_template_folders_parent_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_letter_template_folders_parent_id ON public.letter_template_folders USING btree (parent_id);


--
-- Name: idx_letter_templates_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_letter_templates_active ON public.letter_templates_legacy USING btree (is_active);


--
-- Name: idx_letter_templates_default; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_letter_templates_default ON public.letter_templates USING btree ((true)) WHERE (is_default = true);


--
-- Name: idx_letter_templates_folder_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_letter_templates_folder_id ON public.letter_templates_legacy USING btree (folder_id);


--
-- Name: idx_letters_author_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_letters_author_id ON public.letters USING btree (author_id);


--
-- Name: idx_letters_document_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_letters_document_id ON public.letters USING btree (document_id);


--
-- Name: idx_letters_folder_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_letters_folder_id ON public.letters USING btree (folder_id);


--
-- Name: idx_letters_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_letters_status ON public.letters USING btree (status);


--
-- Name: idx_letters_template_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_letters_template_id ON public.letters USING btree (template_id);


--
-- Name: document_acknowledgements document_acknowledgements_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_acknowledgements
    ADD CONSTRAINT document_acknowledgements_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;


--
-- Name: document_acknowledgements document_acknowledgements_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_acknowledgements
    ADD CONSTRAINT document_acknowledgements_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: document_assignments document_assignments_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_assignments
    ADD CONSTRAINT document_assignments_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;


--
-- Name: document_assignments document_assignments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_assignments
    ADD CONSTRAINT document_assignments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: document_folders document_folders_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_folders
    ADD CONSTRAINT document_folders_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.document_folders(id) ON DELETE SET NULL;


--
-- Name: document_versions document_versions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_versions
    ADD CONSTRAINT document_versions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: document_versions document_versions_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_versions
    ADD CONSTRAINT document_versions_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;


--
-- Name: documents documents_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id);


--
-- Name: documents documents_deleted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES public.users(id);


--
-- Name: documents documents_folder_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES public.document_folders(id) ON DELETE SET NULL;


--
-- Name: email_template_folders email_template_folders_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_template_folders
    ADD CONSTRAINT email_template_folders_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.email_template_folders(id) ON DELETE SET NULL;


--
-- Name: email_templates email_templates_new_folder_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_templates
    ADD CONSTRAINT email_templates_new_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES public.email_template_folders(id) ON DELETE SET NULL;


--
-- Name: letter_template_folders letter_template_folders_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.letter_template_folders
    ADD CONSTRAINT letter_template_folders_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.letter_template_folders(id) ON DELETE SET NULL;


--
-- Name: letter_templates_legacy letter_templates_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.letter_templates_legacy
    ADD CONSTRAINT letter_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: letter_templates_legacy letter_templates_folder_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.letter_templates_legacy
    ADD CONSTRAINT letter_templates_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES public.letter_template_folders(id) ON DELETE SET NULL;


--
-- Name: letter_templates letter_templates_folder_id_fkey1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.letter_templates
    ADD CONSTRAINT letter_templates_folder_id_fkey1 FOREIGN KEY (folder_id) REFERENCES public.letter_template_folders(id) ON DELETE SET NULL;


--
-- Name: letters letters_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.letters
    ADD CONSTRAINT letters_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id);


--
-- Name: letters letters_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.letters
    ADD CONSTRAINT letters_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE SET NULL;


--
-- Name: letters letters_folder_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.letters
    ADD CONSTRAINT letters_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES public.email_template_folders(id) ON DELETE SET NULL;


--
-- Name: letters letters_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.letters
    ADD CONSTRAINT letters_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.letter_templates_legacy(id);


--
-- PostgreSQL database dump complete
--

\unrestrict c0B8MmNlOzEkzKNYaVKD2hPNMFOHghKlOERNG7dcr7a53kL0dYvokWqTuVxr2pX

