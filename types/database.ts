export type CefrLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

export type Collocation = {
  phrase: string;
  meaning_vi: string;
};

export type Synonym = {
  word: string;
  difference_vi: string;
};

export type Antonym = {
  word: string;
  meaning_vi: string;
};

export type ExampleSentence = {
  en: string;
  vi: string;
};

export type EntryRow = {
  id: string;
  user_id: string;
  word: string;
  part_of_speech: string;
  cefr_level: CefrLevel;
  ipa_uk: string;
  ipa_us: string;
  audio_uk_url: string | null;
  audio_us_url: string | null;
  definition_en: string;
  explanation_vi: string;
  nuance_note_vi: string;
  collocations: Collocation[];
  synonyms: Synonym[];
  antonyms: Antonym[];
  examples: ExampleSentence[];
  created_at: string;
};

export type EntryInsert = {
  id?: string;
  user_id: string;
  word: string;
  part_of_speech: string;
  cefr_level: CefrLevel;
  ipa_uk?: string;
  ipa_us?: string;
  audio_uk_url?: string | null;
  audio_us_url?: string | null;
  definition_en: string;
  explanation_vi: string;
  nuance_note_vi?: string;
  collocations?: Collocation[];
  synonyms?: Synonym[];
  antonyms?: Antonym[];
  examples?: ExampleSentence[];
  created_at?: string;
};

export type EntryUpdate = Partial<Omit<EntryInsert, "id" | "user_id">>;

export type SrsCardRow = {
  id: string;
  user_id: string;
  entry_id: string;
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  next_review_at: string;
  last_reviewed_at: string | null;
};

export type SrsCardInsert = {
  id?: string;
  user_id: string;
  entry_id: string;
  ease_factor?: number;
  interval_days?: number;
  repetitions?: number;
  next_review_at?: string;
  last_reviewed_at?: string | null;
};

export type SrsCardUpdate = Partial<
  Omit<SrsCardInsert, "id" | "user_id" | "entry_id">
>;

export type Database = {
  public: {
    Tables: {
      entries: {
        Row: EntryRow;
        Insert: EntryInsert;
        Update: EntryUpdate;
        Relationships: [];
      };
      srs_cards: {
        Row: SrsCardRow;
        Insert: SrsCardInsert;
        Update: SrsCardUpdate;
        Relationships: [
          {
            foreignKeyName: "srs_cards_entry_id_fkey";
            columns: ["entry_id"];
            isOneToOne: true;
            referencedRelation: "entries";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
  };
};
