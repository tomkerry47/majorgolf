--
-- PostgreSQL database dump
--

-- Dumped from database version 16.8
-- Dumped by pg_dump version 17.4

SET statement_timeout = 0;
SET lock_timeout = 0;
-- SET idle_in_transaction_session_timeout = 0; -- Commented out for local compatibility
-- SET transaction_timeout = 0; -- Commented out for local compatibility
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
-- Name: competitions; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.competitions (
    id integer NOT NULL,
    name text NOT NULL,
    venue text NOT NULL,
    "startDate" timestamp without time zone NOT NULL,
    "endDate" timestamp without time zone NOT NULL,
    "selectionDeadline" timestamp without time zone NOT NULL,
    "isActive" boolean DEFAULT false NOT NULL,
    "isComplete" boolean DEFAULT false NOT NULL,
    description text,
    "imageUrl" text
);



--
-- Name: competitions_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.competitions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- Name: competitions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.competitions_id_seq OWNED BY public.competitions.id;


--
-- Name: golfers; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.golfers (
    id integer NOT NULL,
    name text NOT NULL,
    rank integer,
    "avatarUrl" text
);



--
-- Name: golfers_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.golfers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- Name: golfers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.golfers_id_seq OWNED BY public.golfers.id;


--
-- Name: points_system; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.points_system (
    "position" integer NOT NULL,
    points integer NOT NULL
);



--
-- Name: results; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.results (
    id integer NOT NULL,
    "competitionId" integer NOT NULL,
    "golferId" integer NOT NULL,
    "position" integer NOT NULL,
    points integer NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    score integer
);



--
-- Name: results_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.results_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- Name: results_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.results_id_seq OWNED BY public.results.id;


--
-- Name: selections; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.selections (
    id integer NOT NULL,
    "userId" integer NOT NULL,
    "competitionId" integer NOT NULL,
    "golfer1Id" integer NOT NULL,
    "golfer2Id" integer NOT NULL,
    "golfer3Id" integer NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    usecaptainschip boolean DEFAULT false NOT NULL
);



--
-- Name: selections_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.selections_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- Name: selections_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.selections_id_seq OWNED BY public.selections.id;


--
-- Name: user_points; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.user_points (
    id integer NOT NULL,
    "userId" integer NOT NULL,
    "competitionId" integer NOT NULL,
    points integer NOT NULL,
    details text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);



--
-- Name: user_points_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.user_points_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- Name: user_points_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.user_points_id_seq OWNED BY public.user_points.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.users (
    id integer NOT NULL,
    email text NOT NULL,
    username text NOT NULL,
    "fullName" text NOT NULL,
    password text,
    "avatarUrl" text,
    "isAdmin" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "hasUsedWaiverChip" boolean DEFAULT false
);



--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: competitions id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.competitions ALTER COLUMN id SET DEFAULT nextval('public.competitions_id_seq'::regclass);


--
-- Name: golfers id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.golfers ALTER COLUMN id SET DEFAULT nextval('public.golfers_id_seq'::regclass);


--
-- Name: results id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.results ALTER COLUMN id SET DEFAULT nextval('public.results_id_seq'::regclass);


--
-- Name: selections id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.selections ALTER COLUMN id SET DEFAULT nextval('public.selections_id_seq'::regclass);


--
-- Name: user_points id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.user_points ALTER COLUMN id SET DEFAULT nextval('public.user_points_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: competitions; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.competitions (id, name, venue, "startDate", "endDate", "selectionDeadline", "isActive", "isComplete", description, "imageUrl") FROM stdin;
2	US Open 2025	Oakmont Country Club, Pennsylvania	2025-06-12 00:00:00	2025-06-15 00:00:00	2025-06-11 00:00:00	f	f	The 125th U.S. Open Championship	https://golf-assets.com/usopen2025.jpg
3	The Open Championship 2025	Royal Portrush, Northern Ireland	2025-07-17 00:00:00	2025-07-20 00:00:00	2025-07-16 00:00:00	f	f	The 153rd Open Championship	https://golf-assets.com/openChampionship2025.jpg
1	The Masters 2025	Augusta National Golf Club	2025-04-10 00:00:00	2025-04-13 00:00:00	2025-04-09 00:00:00	f	f	The Masters Tournament is one of the four major championships in professional golf.	https://upload.wikimedia.org/wikipedia/en/9/9b/Masters_Tournament_logo.svg
4	PGA Championship 2025	Quail Hollow Club, North Carolina	2025-05-15 00:00:00	2025-05-18 00:00:00	2025-05-14 00:00:00	f	t	The 107th PGA Championship	https://golf-assets.com/pgachampionship2025.jpg
6	The Players Championship	TPC Sawgrass, Florida	2025-03-13 00:00:00	2025-03-16 00:00:00	2025-03-12 00:00:00	f	t	The Players Championship is the PGA Tour's flagship event featuring the strongest field of the year.	https://images.unsplash.com/photo-1600170384874-c11beaeb3bb8?w=800&auto=format&fit=crop&q=60&ixlib=rb-4.0.3
\.


--
-- Data for Name: golfers; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.golfers (id, name, rank, "avatarUrl") FROM stdin;
4	Xander Schauffele	3	https://pga-tour-res.cloudinary.com/image/upload/c_fill,dpr_2.0,f_auto,g_face:center,h_360,q_auto,w_360/v1/pgatour/editorial/2023/08/07/XanderHeadshot-1694.jpg
5	Wyndham Clark	4	https://pga-tour-res.cloudinary.com/image/upload/c_fill,dpr_2.0,f_auto,g_face:center,h_360,q_auto,w_360/v1/pgatour/editorial/2023/08/07/WyndhamHeadshot-1694.jpg
6	Ludvig Åberg	5	https://pga-tour-res.cloudinary.com/image/upload/c_fill,dpr_2.0,f_auto,g_face:center,h_360,q_auto,w_360/v1/pgatour/editorial/2023/08/07/LudvigHeadshot-1694.jpg
7	Viktor Hovland	6	https://pga-tour-res.cloudinary.com/image/upload/c_fill,dpr_2.0,f_auto,g_face:center,h_360,q_auto,w_360/v1/pgatour/editorial/2023/08/07/ViktorHeadshot-1694.jpg
8	Bryson DeChambeau	7	https://pga-tour-res.cloudinary.com/image/upload/c_fill,dpr_2.0,f_auto,g_face:center,h_360,q_auto,w_360/v1/pgatour/editorial/2023/08/07/BrysonHeadshot-1694.jpg
9	Patrick Cantlay	9	https://pga-tour-res.cloudinary.com/image/upload/c_fill,dpr_2.0,f_auto,g_face:center,h_360,q_auto,w_360/v1/pgatour/editorial/2023/08/07/CantlayHeadshot-1694.jpg
10	Collin Morikawa	10	https://pga-tour-res.cloudinary.com/image/upload/c_fill,dpr_2.0,f_auto,g_face:center,h_360,q_auto,w_360/v1/pgatour/editorial/2023/08/07/MorikawaHeadshot-1694.jpg
11	Timothy Wilson	11	\N
12	Richard Walker	12	\N
13	Kenneth Thomas	13	\N
14	Robert Hernandez	14	\N
15	Steven Martin	15	\N
16	Ryan Williams	16	\N
17	Matthew Robinson	17	\N
18	Ronald Miller	18	\N
19	Joseph Lee	19	\N
20	Kevin Anderson	20	\N
21	Michael Young	21	\N
22	Paul Harris	22	\N
23	Jacob Johnson	23	\N
24	Anthony Martinez	24	\N
25	Jason Davis	25	\N
26	Thomas Lewis	26	\N
27	Brian Taylor	27	\N
28	William Allen	28	\N
29	Andrew White	29	\N
30	James Smith	30	\N
31	Mark Garcia	31	\N
32	Edward Brown	32	\N
33	Charles Rodriguez	33	\N
34	George Moore	34	\N
35	David Hall	35	\N
36	Joshua Jackson	36	\N
37	John King	37	\N
38	Donald Thompson	38	\N
39	Jeffrey Jones	39	\N
40	Daniel Clark	40	\N
41	Timothy Wilson	41	\N
42	Richard Walker	42	\N
43	Kenneth Thomas	43	\N
44	Robert Hernandez	44	\N
45	Steven Martin	45	\N
46	Ryan Williams	46	\N
47	Matthew Robinson	47	\N
48	Ronald Miller	48	\N
49	Joseph Lee	49	\N
50	Kevin Anderson	50	\N
51	Michael Young	51	\N
52	Paul Harris	52	\N
53	Jacob Johnson	53	\N
54	Anthony Martinez	54	\N
55	Jason Davis	55	\N
56	Thomas Lewis	56	\N
57	Brian Taylor	57	\N
58	William Allen	58	\N
59	Andrew White	59	\N
60	James Smith	60	\N
61	Mark Garcia	61	\N
62	Edward Brown	62	\N
63	Charles Rodriguez	63	\N
64	George Moore	64	\N
65	David Hall	65	\N
66	Joshua Jackson	66	\N
67	John King	67	\N
68	Donald Thompson	68	\N
69	Jeffrey Jones	69	\N
70	Daniel Clark	70	\N
71	Timothy Wilson	71	\N
72	Richard Walker	72	\N
73	Kenneth Thomas	73	\N
74	Robert Hernandez	74	\N
75	Steven Martin	75	\N
76	Ryan Williams	76	\N
77	Matthew Robinson	77	\N
78	Ronald Miller	78	\N
79	Joseph Lee	79	\N
80	Kevin Anderson	80	\N
81	Michael Young	81	\N
82	Paul Harris	82	\N
83	Jacob Johnson	83	\N
84	Anthony Martinez	84	\N
85	Jason Davis	85	\N
86	Thomas Lewis	86	\N
87	Brian Taylor	87	\N
88	William Allen	88	\N
89	Andrew White	89	\N
90	James Smith	90	\N
91	Mark Garcia	91	\N
92	Edward Brown	92	\N
93	Charles Rodriguez	93	\N
94	George Moore	94	\N
95	David Hall	95	\N
96	Joshua Jackson	96	\N
97	John King	97	\N
98	Donald Thompson	98	\N
99	Jeffrey Jones	99	\N
100	Daniel Clark	100	\N
101	Timothy Wilson	101	\N
102	Richard Walker	102	\N
103	Kenneth Thomas	103	\N
104	Robert Hernandez	104	\N
105	Steven Martin	105	\N
106	Ryan Williams	106	\N
107	Matthew Robinson	107	\N
108	Ronald Miller	108	\N
109	Joseph Lee	109	\N
110	Kevin Anderson	110	\N
111	Michael Young	111	\N
112	Paul Harris	112	\N
113	Jacob Johnson	113	\N
114	Anthony Martinez	114	\N
115	Jason Davis	115	\N
116	Thomas Lewis	116	\N
117	Brian Taylor	117	\N
118	William Allen	118	\N
119	Andrew White	119	\N
120	James Smith	120	\N
121	Mark Garcia	121	\N
122	Edward Brown	122	\N
123	Charles Rodriguez	123	\N
124	George Moore	124	\N
125	David Hall	125	\N
126	Joshua Jackson	126	\N
127	John King	127	\N
128	Donald Thompson	128	\N
129	Jeffrey Jones	129	\N
130	Daniel Clark	130	\N
131	Timothy Wilson	131	\N
132	Richard Walker	132	\N
133	Kenneth Thomas	133	\N
134	Robert Hernandez	134	\N
135	Steven Martin	135	\N
136	Ryan Williams	136	\N
137	Matthew Robinson	137	\N
138	Ronald Miller	138	\N
139	Joseph Lee	139	\N
140	Kevin Anderson	140	\N
141	Michael Young	141	\N
142	Paul Harris	142	\N
143	Jacob Johnson	143	\N
144	Anthony Martinez	144	\N
145	Jason Davis	145	\N
146	Thomas Lewis	146	\N
147	Brian Taylor	147	\N
148	William Allen	148	\N
149	Andrew White	149	\N
150	James Smith	150	\N
151	Mark Garcia	151	\N
152	Edward Brown	152	\N
153	Charles Rodriguez	153	\N
154	George Moore	154	\N
155	David Hall	155	\N
156	Joshua Jackson	156	\N
157	John King	157	\N
158	Donald Thompson	158	\N
159	Jeffrey Jones	159	\N
160	Daniel Clark	160	\N
161	Timothy Wilson	161	\N
162	Richard Walker	162	\N
163	Kenneth Thomas	163	\N
164	Robert Hernandez	164	\N
165	Steven Martin	165	\N
166	Ryan Williams	166	\N
167	Matthew Robinson	167	\N
168	Ronald Miller	168	\N
169	Joseph Lee	169	\N
170	Kevin Anderson	170	\N
171	Michael Young	171	\N
172	Paul Harris	172	\N
173	Jacob Johnson	173	\N
174	Anthony Martinez	174	\N
175	Jason Davis	175	\N
176	Thomas Lewis	176	\N
177	Brian Taylor	177	\N
178	William Allen	178	\N
179	Andrew White	179	\N
180	James Smith	180	\N
181	Mark Garcia	181	\N
182	Edward Brown	182	\N
183	Charles Rodriguez	183	\N
184	George Moore	184	\N
185	David Hall	185	\N
186	Joshua Jackson	186	\N
187	John King	187	\N
188	Donald Thompson	188	\N
189	Jeffrey Jones	189	\N
190	Daniel Clark	190	\N
191	Timothy Wilson	191	\N
192	Richard Walker	192	\N
193	Kenneth Thomas	193	\N
194	Robert Hernandez	194	\N
195	Steven Martin	195	\N
196	Ryan Williams	196	\N
197	Matthew Robinson	197	\N
198	Ronald Miller	198	\N
199	Joseph Lee	199	\N
200	Kevin Anderson	200	\N
201	Michael Young	201	\N
202	Paul Harris	202	\N
203	Jacob Johnson	203	\N
204	Anthony Martinez	204	\N
205	Jason Davis	205	\N
206	Thomas Lewis	206	\N
207	Brian Taylor	207	\N
208	William Allen	208	\N
209	Andrew White	209	\N
210	James Smith	210	\N
211	Mark Garcia	211	\N
212	Edward Brown	212	\N
213	Charles Rodriguez	213	\N
214	George Moore	214	\N
215	David Hall	215	\N
216	Joshua Jackson	216	\N
217	John King	217	\N
218	Donald Thompson	218	\N
219	Jeffrey Jones	219	\N
220	Daniel Clark	220	\N
221	Timothy Wilson	221	\N
222	Richard Walker	222	\N
223	Kenneth Thomas	223	\N
224	Robert Hernandez	224	\N
225	Steven Martin	225	\N
226	Ryan Williams	226	\N
227	Matthew Robinson	227	\N
228	Ronald Miller	228	\N
229	Joseph Lee	229	\N
230	Kevin Anderson	230	\N
231	Michael Young	231	\N
232	Paul Harris	232	\N
233	Jacob Johnson	233	\N
234	Anthony Martinez	234	\N
235	Jason Davis	235	\N
236	Thomas Lewis	236	\N
237	Brian Taylor	237	\N
238	William Allen	238	\N
239	Andrew White	239	\N
240	James Smith	240	\N
241	Mark Garcia	241	\N
242	Edward Brown	242	\N
243	Charles Rodriguez	243	\N
244	George Moore	244	\N
245	David Hall	245	\N
246	Joshua Jackson	246	\N
247	John King	247	\N
248	Donald Thompson	248	\N
249	Jeffrey Jones	249	\N
250	Daniel Clark	250	\N
251	Timothy Wilson	251	\N
252	Richard Walker	252	\N
253	Kenneth Thomas	253	\N
254	Robert Hernandez	254	\N
255	Steven Martin	255	\N
256	Ryan Williams	256	\N
257	Matthew Robinson	257	\N
258	Ronald Miller	258	\N
259	Joseph Lee	259	\N
260	Kevin Anderson	260	\N
261	Michael Young	261	\N
262	Paul Harris	262	\N
263	Jacob Johnson	263	\N
264	Anthony Martinez	264	\N
265	Jason Davis	265	\N
266	Thomas Lewis	266	\N
267	Brian Taylor	267	\N
268	William Allen	268	\N
269	Andrew White	269	\N
270	James Smith	270	\N
271	Mark Garcia	271	\N
272	Edward Brown	272	\N
273	Charles Rodriguez	273	\N
274	George Moore	274	\N
275	David Hall	275	\N
276	Joshua Jackson	276	\N
277	John King	277	\N
278	Donald Thompson	278	\N
279	Jeffrey Jones	279	\N
280	Daniel Clark	280	\N
281	Timothy Wilson	281	\N
282	Richard Walker	282	\N
283	Kenneth Thomas	283	\N
284	Robert Hernandez	284	\N
285	Steven Martin	285	\N
286	Ryan Williams	286	\N
287	Matthew Robinson	287	\N
288	Ronald Miller	288	\N
289	Joseph Lee	289	\N
290	Kevin Anderson	290	\N
291	Michael Young	291	\N
292	Paul Harris	292	\N
293	Jacob Johnson	293	\N
294	Anthony Martinez	294	\N
295	Jason Davis	295	\N
296	Thomas Lewis	296	\N
297	Brian Taylor	297	\N
298	William Allen	298	\N
299	Andrew White	299	\N
300	James Smith	300	\N
301	Mark Garcia	301	\N
302	Edward Brown	302	\N
303	Charles Rodriguez	303	\N
304	George Moore	304	\N
305	David Hall	305	\N
306	Joshua Jackson	306	\N
307	John King	307	\N
308	Donald Thompson	308	\N
309	Jeffrey Jones	309	\N
310	Daniel Clark	310	\N
311	Timothy Wilson	311	\N
312	Richard Walker	312	\N
313	Kenneth Thomas	313	\N
314	Robert Hernandez	314	\N
315	Steven Martin	315	\N
316	Ryan Williams	316	\N
317	Matthew Robinson	317	\N
318	Ronald Miller	318	\N
319	Joseph Lee	319	\N
320	Kevin Anderson	320	\N
321	Michael Young	321	\N
322	Paul Harris	322	\N
323	Jacob Johnson	323	\N
324	Anthony Martinez	324	\N
325	Jason Davis	325	\N
326	Thomas Lewis	326	\N
327	Brian Taylor	327	\N
328	William Allen	328	\N
329	Andrew White	329	\N
330	James Smith	330	\N
331	Mark Garcia	331	\N
332	Edward Brown	332	\N
333	Charles Rodriguez	333	\N
334	George Moore	334	\N
335	David Hall	335	\N
336	Joshua Jackson	336	\N
337	John King	337	\N
338	Donald Thompson	338	\N
339	Jeffrey Jones	339	\N
340	Daniel Clark	340	\N
341	Timothy Wilson	341	\N
342	Richard Walker	342	\N
343	Kenneth Thomas	343	\N
344	Robert Hernandez	344	\N
345	Steven Martin	345	\N
346	Ryan Williams	346	\N
347	Matthew Robinson	347	\N
348	Ronald Miller	348	\N
349	Joseph Lee	349	\N
350	Kevin Anderson	350	\N
351	Michael Young	351	\N
352	Paul Harris	352	\N
353	Jacob Johnson	353	\N
354	Anthony Martinez	354	\N
355	Jason Davis	355	\N
356	Thomas Lewis	356	\N
357	Brian Taylor	357	\N
358	William Allen	358	\N
359	Andrew White	359	\N
360	James Smith	360	\N
361	Mark Garcia	361	\N
362	Edward Brown	362	\N
363	Charles Rodriguez	363	\N
364	George Moore	364	\N
365	David Hall	365	\N
366	Joshua Jackson	366	\N
367	John King	367	\N
368	Donald Thompson	368	\N
369	Jeffrey Jones	369	\N
370	Daniel Clark	370	\N
371	Timothy Wilson	371	\N
372	Richard Walker	372	\N
373	Kenneth Thomas	373	\N
374	Robert Hernandez	374	\N
375	Steven Martin	375	\N
376	Ryan Williams	376	\N
377	Matthew Robinson	377	\N
378	Ronald Miller	378	\N
379	Joseph Lee	379	\N
380	Kevin Anderson	380	\N
381	Michael Young	381	\N
382	Paul Harris	382	\N
383	Jacob Johnson	383	\N
384	Anthony Martinez	384	\N
385	Jason Davis	385	\N
386	Thomas Lewis	386	\N
387	Brian Taylor	387	\N
388	William Allen	388	\N
389	Andrew White	389	\N
390	James Smith	390	\N
391	Mark Garcia	391	\N
392	Edward Brown	392	\N
393	Charles Rodriguez	393	\N
394	George Moore	394	\N
395	David Hall	395	\N
396	Joshua Jackson	396	\N
397	John King	397	\N
398	Donald Thompson	398	\N
399	Jeffrey Jones	399	\N
400	Daniel Clark	400	\N
401	Timothy Wilson	401	\N
402	Richard Walker	402	\N
403	Kenneth Thomas	403	\N
404	Robert Hernandez	404	\N
405	Steven Martin	405	\N
406	Ryan Williams	406	\N
407	Matthew Robinson	407	\N
408	Ronald Miller	408	\N
409	Joseph Lee	409	\N
410	Kevin Anderson	410	\N
411	Michael Young	411	\N
412	Paul Harris	412	\N
413	Jacob Johnson	413	\N
414	Anthony Martinez	414	\N
415	Jason Davis	415	\N
416	Thomas Lewis	416	\N
417	Brian Taylor	417	\N
418	William Allen	418	\N
419	Andrew White	419	\N
420	James Smith	420	\N
421	Mark Garcia	421	\N
422	Edward Brown	422	\N
423	Charles Rodriguez	423	\N
424	George Moore	424	\N
425	David Hall	425	\N
426	Joshua Jackson	426	\N
427	John King	427	\N
428	Donald Thompson	428	\N
429	Jeffrey Jones	429	\N
430	Daniel Clark	430	\N
431	Timothy Wilson	431	\N
432	Richard Walker	432	\N
433	Kenneth Thomas	433	\N
434	Robert Hernandez	434	\N
435	Steven Martin	435	\N
436	Ryan Williams	436	\N
437	Matthew Robinson	437	\N
438	Ronald Miller	438	\N
439	Joseph Lee	439	\N
440	Kevin Anderson	440	\N
441	Michael Young	441	\N
442	Paul Harris	442	\N
443	Jacob Johnson	443	\N
444	Anthony Martinez	444	\N
445	Jason Davis	445	\N
446	Thomas Lewis	446	\N
447	Brian Taylor	447	\N
448	William Allen	448	\N
449	Andrew White	449	\N
450	James Smith	450	\N
451	Mark Garcia	451	\N
452	Edward Brown	452	\N
453	Charles Rodriguez	453	\N
454	George Moore	454	\N
455	David Hall	455	\N
456	Joshua Jackson	456	\N
457	John King	457	\N
458	Donald Thompson	458	\N
459	Jeffrey Jones	459	\N
460	Daniel Clark	460	\N
461	Timothy Wilson	461	\N
462	Richard Walker	462	\N
463	Kenneth Thomas	463	\N
464	Robert Hernandez	464	\N
465	Steven Martin	465	\N
466	Ryan Williams	466	\N
467	Matthew Robinson	467	\N
468	Ronald Miller	468	\N
469	Joseph Lee	469	\N
470	Kevin Anderson	470	\N
471	Michael Young	471	\N
472	Paul Harris	472	\N
473	Jacob Johnson	473	\N
474	Anthony Martinez	474	\N
475	Jason Davis	475	\N
476	Thomas Lewis	476	\N
477	Brian Taylor	477	\N
478	William Allen	478	\N
479	Andrew White	479	\N
480	James Smith	480	\N
481	Mark Garcia	481	\N
482	Edward Brown	482	\N
483	Charles Rodriguez	483	\N
484	George Moore	484	\N
485	David Hall	485	\N
486	Joshua Jackson	486	\N
487	John King	487	\N
488	Donald Thompson	488	\N
489	Jeffrey Jones	489	\N
490	Daniel Clark	490	\N
491	Timothy Wilson	491	\N
492	Richard Walker	492	\N
493	Kenneth Thomas	493	\N
494	Robert Hernandez	494	\N
495	Steven Martin	495	\N
496	Ryan Williams	496	\N
497	Matthew Robinson	497	\N
498	Ronald Miller	498	\N
499	Joseph Lee	499	\N
500	Kevin Anderson	500	\N
1	Scottie Scheffler	1	https://pga-tour-res.cloudinary.com/image/upload/c_fill,dpr_2.0,f_auto,g_face:center,h_360,q_auto,w_360/v1/pgatour/editorial/2023/08/07/ScottieHeadshot-1694.jpg
2	Rory McIlroy	2	https://pga-tour-res.cloudinary.com/image/upload/c_fill,dpr_2.0,f_auto,g_face:center,h_360,q_auto,w_360/v1/pgatour/editorial/2023/08/07/RoryHeadshot-1695.jpg
3	Jon Rahm	8	https://pga-tour-res.cloudinary.com/image/upload/c_fill,dpr_2.0,f_auto,g_face:center,h_360,q_auto,w_360/v1/pgatour/editorial/2023/08/03/RahmHeadshot-1694.jpg
\.


--
-- Data for Name: points_system; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.points_system ("position", points) FROM stdin;
1	25
2	15
3	15
4	15
5	15
6	10
7	10
8	10
9	10
10	10
11	5
12	5
13	5
14	5
15	5
16	5
17	5
18	5
19	5
20	5
21	1
22	1
23	1
24	1
25	1
26	1
27	1
28	1
29	1
30	1
0	-7
\.


--
-- Data for Name: results; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.results (id, "competitionId", "golferId", "position", points, created_at, score) FROM stdin;
1	1	1	1	10	2025-03-19 20:54:55.689519+00	\N
2	1	2	3	8	2025-03-19 20:54:55.689519+00	\N
3	1	3	5	6	2025-03-19 20:54:55.689519+00	\N
34	6	1	1	25	2025-03-19 21:03:18.780541+00	-12
35	6	2	2	15	2025-03-19 21:03:18.780541+00	-10
36	6	3	3	15	2025-03-19 21:03:18.780541+00	-9
37	6	4	4	15	2025-03-19 21:03:18.780541+00	-8
38	6	5	5	15	2025-03-19 21:03:18.780541+00	-7
39	6	6	6	10	2025-03-19 21:03:18.780541+00	-6
40	6	7	7	10	2025-03-19 21:03:18.780541+00	-5
41	6	8	8	10	2025-03-19 21:03:18.780541+00	-4
42	6	9	9	10	2025-03-19 21:03:18.780541+00	-3
43	6	10	10	10	2025-03-19 21:03:18.780541+00	-2
44	6	11	11	5	2025-03-19 21:03:18.780541+00	-1
45	6	12	12	5	2025-03-19 21:03:18.780541+00	0
46	6	13	13	5	2025-03-19 21:03:18.780541+00	1
47	6	14	14	5	2025-03-19 21:03:18.780541+00	2
48	6	15	15	5	2025-03-19 21:03:18.780541+00	3
49	6	16	16	5	2025-03-19 21:03:18.780541+00	4
50	6	17	17	5	2025-03-19 21:03:18.780541+00	5
51	6	18	18	5	2025-03-19 21:03:18.780541+00	6
52	6	19	19	5	2025-03-19 21:03:18.780541+00	7
53	6	20	20	5	2025-03-19 21:03:18.780541+00	8
54	6	21	21	1	2025-03-19 21:03:18.780541+00	9
55	6	22	22	1	2025-03-19 21:03:18.780541+00	10
56	6	23	23	1	2025-03-19 21:03:18.780541+00	11
57	6	24	24	1	2025-03-19 21:03:18.780541+00	12
58	6	25	25	1	2025-03-19 21:03:18.780541+00	13
59	6	26	26	1	2025-03-19 21:03:18.780541+00	14
60	6	27	27	1	2025-03-19 21:03:18.780541+00	15
61	6	28	28	1	2025-03-19 21:03:18.780541+00	16
62	6	29	29	1	2025-03-19 21:03:18.780541+00	17
63	6	30	30	1	2025-03-19 21:03:18.780541+00	18
\.


--
-- Data for Name: selections; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.selections (id, "userId", "competitionId", "golfer1Id", "golfer2Id", "golfer3Id", "createdAt", "updatedAt", usecaptainschip) FROM stdin;
\.


--
-- Data for Name: user_points; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.user_points (id, "userId", "competitionId", points, details, created_at, updated_at) FROM stdin;
1	1	6	50	[{"golferId":1,"golferName":"Scottie Scheffler","position":1,"points":25},{"golferId":5,"golferName":"Wyndham Clark","position":5,"points":15},{"golferId":10,"golferName":"Collin Morikawa","position":10,"points":10}]	2025-03-19 21:09:20.459757	2025-03-19 21:09:20.459757
2	2	6	30	[{"golferId":2,"golferName":"Rory McIlroy","position":2,"points":15},{"golferId":6,"golferName":"Ludvig Åberg","position":6,"points":10},{"golferId":15,"golferName":"Steven Martin","position":15,"points":5}]	2025-03-19 21:09:20.783799	2025-03-19 21:09:20.783799
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.users (id, email, username, "fullName", password, "avatarUrl", "isAdmin", "createdAt", "hasUsedWaiverChip") FROM stdin;
3	demo@example.com	demoplayer	Demo Player	$2b$10$0neSEBEbebiHjK15HEo1teB81lsnZtyk4SEdq2/IvQKhQMVbm00nW	\N	f	2025-03-19 21:20:26.219856	f
2	test@test.com	test	test	$2a$10$9T39X.b6vDXGP1vIg/iP8eZ0jlfL.ZS1VYGaFZu0w8C78sQYZBfbC	\N	f	2025-03-19 19:35:02.387507	f
1	thomaskerry@me.com	thomaskerry	Thomas Kerry	$2b$10$1EycJb62uWgoCM.WxlxnQeqnmZNi0WHSf6pTaU4wGnLfRJ/OXWKHi	\N	t	2025-03-18 21:11:19.755094	f
\.


--
-- Name: competitions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.competitions_id_seq', 4, true);


--
-- Name: golfers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.golfers_id_seq', 500, true);


--
-- Name: results_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.results_id_seq', 63, true);


--
-- Name: selections_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.selections_id_seq', 6, true);


--
-- Name: user_points_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.user_points_id_seq', 2, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.users_id_seq', 3, true);


--
-- Name: competitions competitions_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.competitions
    ADD CONSTRAINT competitions_pkey PRIMARY KEY (id);


--
-- Name: golfers golfers_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.golfers
    ADD CONSTRAINT golfers_pkey PRIMARY KEY (id);


--
-- Name: points_system points_system_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.points_system
    ADD CONSTRAINT points_system_pkey PRIMARY KEY ("position");


--
-- Name: results results_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.results
    ADD CONSTRAINT results_pkey PRIMARY KEY (id);


--
-- Name: selections selections_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.selections
    ADD CONSTRAINT selections_pkey PRIMARY KEY (id);


--
-- Name: selections selections_user_competition_unique_idx; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.selections
    ADD CONSTRAINT selections_user_competition_unique_idx UNIQUE ("userId", "competitionId");


--
-- Name: user_points user_points_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.user_points
    ADD CONSTRAINT user_points_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: results results_competitionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.results
    ADD CONSTRAINT "results_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES public.competitions(id);


--
-- Name: results results_golferId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.results
    ADD CONSTRAINT "results_golferId_fkey" FOREIGN KEY ("golferId") REFERENCES public.golfers(id);


--
-- Name: selections selections_competitionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.selections
    ADD CONSTRAINT "selections_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES public.competitions(id);


--
-- Name: selections selections_golfer1Id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.selections
    ADD CONSTRAINT "selections_golfer1Id_fkey" FOREIGN KEY ("golfer1Id") REFERENCES public.golfers(id);


--
-- Name: selections selections_golfer2Id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.selections
    ADD CONSTRAINT "selections_golfer2Id_fkey" FOREIGN KEY ("golfer2Id") REFERENCES public.golfers(id);


--
-- Name: selections selections_golfer3Id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.selections
    ADD CONSTRAINT "selections_golfer3Id_fkey" FOREIGN KEY ("golfer3Id") REFERENCES public.golfers(id);


--
-- Name: selections selections_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.selections
    ADD CONSTRAINT "selections_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id);


--
-- Name: competitions; Type: ROW SECURITY; Schema: public; Owner: neondb_owner
--

ALTER TABLE public.competitions ENABLE ROW LEVEL SECURITY;

--
-- Name: competitions competitions_policy; Type: POLICY; Schema: public; Owner: neondb_owner
--

CREATE POLICY competitions_policy ON public.competitions USING (true) WITH CHECK (true);


--
-- Name: golfers; Type: ROW SECURITY; Schema: public; Owner: neondb_owner
--

ALTER TABLE public.golfers ENABLE ROW LEVEL SECURITY;

--
-- Name: golfers golfers_policy; Type: POLICY; Schema: public; Owner: neondb_owner
--

CREATE POLICY golfers_policy ON public.golfers USING (true) WITH CHECK (true);


--
-- Name: points_system; Type: ROW SECURITY; Schema: public; Owner: neondb_owner
--

ALTER TABLE public.points_system ENABLE ROW LEVEL SECURITY;

--
-- Name: points_system points_system_policy; Type: POLICY; Schema: public; Owner: neondb_owner
--

CREATE POLICY points_system_policy ON public.points_system USING (true) WITH CHECK (true);


--
-- Name: results; Type: ROW SECURITY; Schema: public; Owner: neondb_owner
--

ALTER TABLE public.results ENABLE ROW LEVEL SECURITY;

--
-- Name: results results_policy; Type: POLICY; Schema: public; Owner: neondb_owner
--

CREATE POLICY results_policy ON public.results USING (true) WITH CHECK (true);


--
-- Name: selections; Type: ROW SECURITY; Schema: public; Owner: neondb_owner
--

ALTER TABLE public.selections ENABLE ROW LEVEL SECURITY;

--
-- Name: selections selections_policy; Type: POLICY; Schema: public; Owner: neondb_owner
--

CREATE POLICY selections_policy ON public.selections USING (true) WITH CHECK (true);


--
-- Name: users; Type: ROW SECURITY; Schema: public; Owner: neondb_owner
--

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

--
-- Name: users users_policy; Type: POLICY; Schema: public; Owner: neondb_owner
--

CREATE POLICY users_policy ON public.users USING (true) WITH CHECK (true);


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: cloud_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE cloud_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO neon_superuser WITH GRANT OPTION;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: cloud_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE cloud_admin IN SCHEMA public GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO neon_superuser WITH GRANT OPTION;


--
-- PostgreSQL database dump complete
--
