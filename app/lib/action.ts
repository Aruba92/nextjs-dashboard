'use server';
import { z } from 'zod';
import { sql } from '@vercel/postgres';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { signIn } from '@/auth';
import { AuthError } from 'next-auth';

/* handle type validation */
/*
    export async function createInvoice(prevState: State, formData: FormData) {} //prevState added
    FormSchema = z.object                           conte les validacions
    CreateInvoice = FormSchema.omit()               especifica valors opcionals
    validatedFields = CreateInvoice.safeParse       comproba la validacio
    validatedFields.succes                          resultat de la validacio (true/false)
    validatedFields.error.flatten().fieldErrors     resultat de la validacio si false
 */
const FormSchema = z.object({
    id: z.string(),
    customerId: z.string({
      invalid_type_error: 'Please select a customer.',
    }),
    amount: z.coerce.number().gt(0, { /* we always want the amount greater than 0 */
        message: 'Please enter an amount greater than $0.' 
    }),
    status: z.enum(['pending', 'paid'], {
      invalid_type_error: 'Please select an invoice status.',
    }),
    date: z.string(),
  });
 
const CreateInvoice = FormSchema.omit({ id: true, date: true });

export type State = {
    errors?: {
      customerId?: string[];
      amount?: string[];
      status?: string[];
    };
    message?: string | null;
  };

/* Get the Form data*/
export async function createInvoice(prevState: State, formData: FormData) {
    /* FormData With entries() */
    /* for (const pair of formData.entries()) {
        console.log("FORMDATA: " + pair[0], pair[1]);
    } */

    /* FormData With get(name) */
    const validatedFields = CreateInvoice.safeParse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    });
    console.log("validatedFields: " + JSON.stringify(validatedFields, null, 2));
    
    if (!validatedFields.success) {
        console.log("fieldErrors: " + JSON.stringify(validatedFields.error.flatten().fieldErrors, null, 2));
        return {
            errors: validatedFields.error.flatten().fieldErrors,
            message: 'Missing Fields. Failed to Create Invoice.',
        };
    }

    const { customerId, amount, status } = validatedFields.data;
    const amountInCents = amount * 100; /* store monetary values in cents */
    const date = new Date().toISOString().split('T')[0];
    
    try{
        await sql`
            INSERT INTO invoices (customer_id, amount, status, date)
            VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
        `;
    }catch(error){
        return{
            message: 'Database Error: Failed to Create Invoice.',
        };
    }
    
    revalidatePath('/dashboard/invoices'); /*  clear the cache and trigger a new request to the server, for update data with the new one */
    redirect('/dashboard/invoices');
}


// Use Zod to update the expected types
const UpdateInvoice = FormSchema.omit({ id: true, date: true });
 
export async function updateInvoice(id: string, prevState: State, formData: FormData) {
    const validatedFields = UpdateInvoice.safeParse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    });

    if (!validatedFields.success) {
        return {
            errors: validatedFields.error.flatten().fieldErrors,
            message: 'Missing Fields. Failed to Create Invoice.',
        };
    }

    const { customerId, amount, status } = validatedFields.data;
    const amountInCents = amount * 100;
 
  try{
    await sql`
        UPDATE invoices
        SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
        WHERE id = ${id}
    `;
    }catch(error){
        return { message: 'Database Error: Failed to Update Invoice.' };
    };

  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
}


export async function deleteInvoice(id: string) {
    /* throw new Error('Failed to Delete Invoice'); */
    try{
        await sql`DELETE FROM invoices WHERE id = ${id}`;
        revalidatePath('/dashboard/invoices');
        return { message: 'Deleted Invoice.' };
    }catch(error){
        return { message: 'Database Error: Failed to Delete Invoice.' };
    }
  }

  export async function authenticate(
    prevState: string | undefined,
    formData: FormData,
  ) {
    try {
      await signIn('credentials', formData);
    } catch (error) {
      if (error instanceof AuthError) {
        switch (error.type) {
          case 'CredentialsSignin':
            return 'Invalid credentials.';
          default:
            return 'Something went wrong.';
        }
      }
      throw error;
    }
  }